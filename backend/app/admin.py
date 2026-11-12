"""Credential management. Meant to be called only by the bundled website's server
(X-Admin-Key). Block /admin/ at your reverse proxy for the public API domain."""

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from .config import settings
from .keys import KeyStore


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    expected = settings.pygmy_admin_key
    if not expected:
        raise HTTPException(404, "Not found")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, expected):
        raise HTTPException(401, "Unauthorized")


def store(request: Request) -> KeyStore:
    return request.app.state.keys


router = APIRouter(
    prefix="/admin", dependencies=[Depends(require_admin)], include_in_schema=False
)


class CreateBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def clean(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("empty")
        return v


class PatchBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    enabled: bool | None = None

    @field_validator("name")
    @classmethod
    def clean(cls, v: str | None) -> str | None:
        return v.strip() if v else v


def _ident(kid: str) -> str:
    if not kid.isalnum() or len(kid) > 16:
        raise HTTPException(404, "Not found")
    return kid


@router.get("/keys")
async def list_keys(ks: KeyStore = Depends(store)):
    return {"keys": await ks.list()}


@router.post("/keys", status_code=201)
async def create_key(body: CreateBody, ks: KeyStore = Depends(store)):
    key, secret = await ks.create(body.name)
    return {"key": key, "secret": secret}


@router.patch("/keys/{kid}")
async def patch_key(kid: str, body: PatchBody, ks: KeyStore = Depends(store)):
    key = await ks.update(_ident(kid), body.name, body.enabled)
    if not key:
        raise HTTPException(404, "Not found")
    return {"key": key}


@router.post("/keys/{kid}/rotate")
async def rotate_key(kid: str, ks: KeyStore = Depends(store)):
    res = await ks.rotate(_ident(kid))
    if not res:
        raise HTTPException(404, "Not found")
    key, secret = res
    return {"key": key, "secret": secret}


@router.delete("/keys/{kid}", status_code=204)
async def delete_key(kid: str, ks: KeyStore = Depends(store)):
    if not await ks.delete(_ident(kid)):
        raise HTTPException(404, "Not found")
