import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from redis.asyncio import Redis

from .admin import router as admin_router
from .config import settings
from .keys import WEB, KeyStore
from .otp import OtpService, RequestResult, VerifyResult
from .senders import build_sender

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pygmy")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.otp_secret == "change-me" and settings.otp_sender != "console":
        raise RuntimeError("Set OTP_SECRET to a long random value")
    if len(settings.pygmy_web_key) < 16:
        raise RuntimeError("PYGMY_WEB_KEY must be at least 16 chars")
    if settings.pygmy_admin_key and len(settings.pygmy_admin_key) < 32:
        raise RuntimeError("PYGMY_ADMIN_KEY must be at least 32 chars")
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    app.state.keys = KeyStore(redis)
    app.state.otp = OtpService(redis, settings, build_sender(settings))
    yield
    await redis.aclose()


app = FastAPI(
    title="pygmy",
    description="OTP por e-mail. Autentique com `Authorization: Bearer <api-key>` "
    "ou `X-API-Key`.",
    version="1.0.0",
    lifespan=lifespan,
)


def get_service(request: Request) -> OtpService:
    return request.app.state.otp


app.include_router(admin_router)


async def authenticate(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> str:
    """Returns the client id (OTP namespace) for a valid API key."""
    token = x_api_key
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token:
        if hmac.compare_digest(token, settings.pygmy_web_key):
            return WEB
        kid = await request.app.state.keys.find(token)
        if kid:
            return kid
    raise HTTPException(
        401, "API key ausente ou inválida.", headers={"WWW-Authenticate": "Bearer"}
    )


class RequestBody(BaseModel):
    email: EmailStr
    app_name: str | None = Field(
        default=None,
        max_length=40,
        description="Nome exibido no e-mail (padrão: pygmy).",
    )


class VerifyBody(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{4,10}$")


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@app.post("/v1/otp/request", status_code=202)
async def request_otp(
    body: RequestBody,
    request: Request,
    client: str = Depends(authenticate),
    svc: OtpService = Depends(get_service),
    x_end_user_ip: str | None = Header(default=None),
):
    """Envia um código OTP para o e-mail. Mande `X-End-User-IP` (IP do usuário final)
    para ativar o limite por IP."""
    try:
        result = await svc.request(
            client, body.email, x_end_user_ip, body.app_name or settings.app_name
        )
    except Exception:
        log.exception("failed to send OTP")
        raise HTTPException(503, "Não foi possível enviar o código agora.")

    if result is RequestResult.COOLDOWN:
        raise HTTPException(
            429,
            f"Aguarde {settings.otp_resend_cooldown_seconds}s antes de pedir outro código.",
        )
    if result is RequestResult.RATE_LIMITED:
        raise HTTPException(429, "Muitas solicitações. Tente novamente mais tarde.")
    await request.app.state.keys.touch(client, "sent")
    return {"status": "sent", "expires_in": settings.otp_ttl_seconds}


@app.post("/v1/otp/verify")
async def verify_otp(
    body: VerifyBody,
    request: Request,
    client: str = Depends(authenticate),
    svc: OtpService = Depends(get_service),
):
    """Valida o código. Uso único: `verified: true` só é devolvido uma vez."""
    result = await svc.verify(client, body.email, body.code)
    await request.app.state.keys.touch(
        client, "ok" if result is VerifyResult.OK else "fail"
    )
    if result is VerifyResult.OK:
        return {"verified": True}
    if result is VerifyResult.TOO_MANY_ATTEMPTS:
        raise HTTPException(429, "Tentativas excedidas. Solicite um novo código.")
    raise HTTPException(400, "Código inválido ou expirado.")
