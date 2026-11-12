import hashlib
import hmac
import secrets
from enum import Enum

from redis.asyncio import Redis

from .config import Settings


class RequestResult(str, Enum):
    SENT = "sent"
    COOLDOWN = "cooldown"
    RATE_LIMITED = "rate_limited"


class VerifyResult(str, Enum):
    OK = "ok"
    INVALID = "invalid"  # wrong code, or no active code
    TOO_MANY_ATTEMPTS = "too_many_attempts"


class OtpService:
    def __init__(self, redis: Redis, settings: Settings, sender):
        self.r = redis
        self.s = settings
        self.sender = sender

    # --- helpers -------------------------------------------------------
    def _id(self, client: str, email: str) -> str:
        """Namespaced per client so projects never share codes or limits."""
        return hashlib.sha256(f"{client}\0{email.strip().lower()}".encode()).hexdigest()

    def _hash(self, ident: str, code: str) -> str:
        return hmac.new(
            self.s.otp_secret.encode(), f"{ident}:{code}".encode(), hashlib.sha256
        ).hexdigest()

    def _generate(self) -> str:
        n = self.s.otp_length
        return f"{secrets.randbelow(10**n):0{n}d}"

    async def _hit(self, key: str, limit: int, window: int) -> bool:
        """Count a hit; return True if still within limit."""
        count = await self.r.incr(key)
        if count == 1:
            await self.r.expire(key, window)
        return count <= limit

    # --- API -----------------------------------------------------------
    async def request(
        self, client: str, email: str, ip: str | None, app_name: str
    ) -> RequestResult:
        s = self.s
        ident = self._id(client, email)

        # Cooldown first (cheap, atomic). Not counted against rate limits.
        if not await self.r.set(
            f"otp:cd:{ident}", 1, nx=True, ex=s.otp_resend_cooldown_seconds
        ):
            return RequestResult.COOLDOWN

        ok = await self._hit(f"otp:rl:email:{ident}", s.otp_max_requests_per_hour, 3600)
        if ip:
            ok_ip = await self._hit(
                f"otp:rl:ip:{client}:{ip[:64]}", s.otp_max_requests_per_hour_per_ip, 3600
            )
            ok = ok and ok_ip
        if not ok:
            return RequestResult.RATE_LIMITED

        code = self._generate()
        key = f"otp:code:{ident}"
        # Replaces any previous code and resets attempts.
        async with self.r.pipeline(transaction=True) as p:
            p.delete(key)
            p.hset(key, mapping={"h": self._hash(ident, code), "a": 0})
            p.expire(key, s.otp_ttl_seconds)
            await p.execute()

        try:
            await self.sender.send(email, code, s.otp_ttl_seconds // 60, app_name)
        except Exception:
            # Don't leave a code the user never received; allow immediate retry.
            await self.r.delete(key, f"otp:cd:{ident}")
            raise
        return RequestResult.SENT

    async def verify(self, client: str, email: str, code: str) -> VerifyResult:
        ident = self._id(client, email)
        key = f"otp:code:{ident}"

        stored = await self.r.hget(key, "h")
        if stored is None:
            return VerifyResult.INVALID

        attempts = await self.r.hincrby(key, "a", 1)
        if attempts > self.s.otp_max_attempts:
            await self.r.delete(key)
            return VerifyResult.TOO_MANY_ATTEMPTS

        if hmac.compare_digest(stored, self._hash(ident, code)):
            # Single use: only one concurrent verifier can win the delete.
            if await self.r.delete(key):
                return VerifyResult.OK
            return VerifyResult.INVALID

        if attempts >= self.s.otp_max_attempts:
            await self.r.delete(key)
            return VerifyResult.TOO_MANY_ATTEMPTS
        return VerifyResult.INVALID
