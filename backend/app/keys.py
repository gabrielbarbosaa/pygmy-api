"""Credential (API key) store, kept in Redis.

Only a SHA-256 of each key is stored; the secret is shown once, at creation/rotation.
The key *id* (not its name) is the OTP namespace, so renaming never breaks anything.
"""

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis

WEB = "web"  # built-in client used by the bundled website demo
STAT_DAYS = 14
STAT_TTL = 45 * 86400


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def _kkey(kid: str) -> str:
    return f"pygmy:key:{kid}"


def _skey(kid: str, day: str) -> str:
    return f"pygmy:stat:{kid}:{day}"


def _today() -> datetime:
    return datetime.now(timezone.utc)


class KeyStore:
    def __init__(self, redis: Redis):
        self.r = redis

    # --- auth ----------------------------------------------------------
    async def find(self, secret: str) -> str | None:
        """Returns the key id for an enabled key, else None."""
        kid = await self.r.hget("pygmy:keyidx", _hash(secret))
        if kid and await self.r.hget(_kkey(kid), "enabled") == "1":
            return kid
        return None

    # --- usage ---------------------------------------------------------
    async def touch(self, kid: str, event: str) -> None:
        """event: sent | ok | fail"""
        if kid != WEB and not await self.r.exists(_kkey(kid)):
            return
        day = _skey(kid, _today().strftime("%Y%m%d"))
        async with self.r.pipeline(transaction=False) as p:
            p.hincrby(_kkey(kid), f"n_{event}", 1)
            p.hset(_kkey(kid), "last_used", int(time.time()))
            p.hincrby(day, event, 1)
            p.expire(day, STAT_TTL)
            await p.execute()

    # --- CRUD ----------------------------------------------------------
    @staticmethod
    def _new_secret() -> str:
        return "pyg_" + secrets.token_urlsafe(32)

    async def create(self, name: str) -> tuple[dict, str]:
        kid = secrets.token_hex(4)
        secret = self._new_secret()
        async with self.r.pipeline(transaction=True) as p:
            p.hset(
                _kkey(kid),
                mapping={
                    "name": name,
                    "hash": _hash(secret),
                    "prefix": secret[:8],
                    "enabled": "1",
                    "created": int(time.time()),
                },
            )
            p.hset("pygmy:keyidx", _hash(secret), kid)
            p.sadd("pygmy:keys", kid)
            await p.execute()
        return (await self.get(kid)), secret  # type: ignore[return-value]

    async def update(self, kid: str, name: str | None, enabled: bool | None) -> dict | None:
        if not await self.r.sismember("pygmy:keys", kid):
            return None
        mapping: dict[str, str] = {}
        if name is not None:
            mapping["name"] = name
        if enabled is not None:
            mapping["enabled"] = "1" if enabled else "0"
        if mapping:
            await self.r.hset(_kkey(kid), mapping=mapping)
        return await self.get(kid)

    async def rotate(self, kid: str) -> tuple[dict, str] | None:
        if not await self.r.sismember("pygmy:keys", kid):
            return None
        old = await self.r.hget(_kkey(kid), "hash")
        secret = self._new_secret()
        async with self.r.pipeline(transaction=True) as p:
            if old:
                p.hdel("pygmy:keyidx", old)
            p.hset("pygmy:keyidx", _hash(secret), kid)
            p.hset(_kkey(kid), mapping={"hash": _hash(secret), "prefix": secret[:8]})
            await p.execute()
        return (await self.get(kid)), secret  # type: ignore[return-value]

    async def delete(self, kid: str) -> bool:
        if not await self.r.sismember("pygmy:keys", kid):
            return False
        old = await self.r.hget(_kkey(kid), "hash")
        async with self.r.pipeline(transaction=True) as p:
            if old:
                p.hdel("pygmy:keyidx", old)
            p.delete(_kkey(kid))
            p.srem("pygmy:keys", kid)
            await p.execute()
        return True

    # --- reads ---------------------------------------------------------
    async def _daily(self, kid: str) -> list[dict]:
        days = [_today() - timedelta(days=i) for i in range(STAT_DAYS - 1, -1, -1)]
        async with self.r.pipeline(transaction=False) as p:
            for d in days:
                p.hgetall(_skey(kid, d.strftime("%Y%m%d")))
            rows = await p.execute()
        return [
            {
                "date": d.strftime("%Y-%m-%d"),
                "sent": int(r.get("sent", 0)),
                "ok": int(r.get("ok", 0)),
                "fail": int(r.get("fail", 0)),
            }
            for d, r in zip(days, rows)
        ]

    async def _view(self, kid: str, h: dict, builtin: bool = False) -> dict:
        return {
            "id": kid,
            "name": h.get("name", "Site (demo)" if builtin else kid),
            "prefix": h.get("prefix", "embutida" if builtin else ""),
            "enabled": h.get("enabled", "1") == "1",
            "builtin": builtin,
            "created": int(h["created"]) if h.get("created") else None,
            "last_used": int(h["last_used"]) if h.get("last_used") else None,
            "totals": {
                "sent": int(h.get("n_sent", 0)),
                "ok": int(h.get("n_ok", 0)),
                "fail": int(h.get("n_fail", 0)),
            },
            "daily": await self._daily(kid),
        }

    async def get(self, kid: str) -> dict | None:
        h = await self.r.hgetall(_kkey(kid))
        return await self._view(kid, h) if h else None

    async def list(self) -> list[dict]:
        ids = await self.r.smembers("pygmy:keys")
        keys = [k for k in [await self.get(i) for i in ids] if k]
        keys.sort(key=lambda k: k["created"] or 0, reverse=True)
        web = await self._view(WEB, await self.r.hgetall(_kkey(WEB)), builtin=True)
        return keys + [web]
