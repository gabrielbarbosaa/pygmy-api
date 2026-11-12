import re

import fakeredis.aioredis
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, settings
from app.keys import KeyStore
from app.main import app
from app.otp import OtpService

WEB_KEY = "w" * 20
ADMIN = "A" * 40
AH = {"X-Admin-Key": ADMIN}


class CaptureSender:
    def __init__(self):
        self.codes = {}
        self.names = {}

    async def send(self, to, code, ttl_minutes, app_name):
        self.codes[to] = code
        self.names[to] = app_name


@pytest.fixture
async def ctx(monkeypatch):
    monkeypatch.setattr(settings, "pygmy_web_key", WEB_KEY)
    monkeypatch.setattr(settings, "pygmy_admin_key", ADMIN)
    sender = CaptureSender()
    s = Settings(otp_secret="test", otp_resend_cooldown_seconds=60, otp_max_attempts=3)
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    app.state.otp = OtpService(redis, s, sender)
    app.state.keys = KeyStore(redis)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://t"
    ) as c:
        yield c, sender, app.state.keys


async def mk(c, name):
    r = await c.post("/admin/keys", json={"name": name}, headers=AH)
    assert r.status_code == 201
    j = r.json()
    return j["key"]["id"], {"Authorization": f"Bearer {j['secret']}"}


def req(c, email="a@b.com", h=None, **extra):
    return c.post("/v1/otp/request", json={"email": email, **extra}, headers=h)


def ver(c, code, email="a@b.com", h=None):
    return c.post("/v1/otp/verify", json={"email": email, "code": code}, headers=h)


# --- OTP -------------------------------------------------------------------
async def test_requires_api_key(ctx):
    c, _, _ = ctx
    assert (await req(c)).status_code == 401
    assert (await req(c, h={"Authorization": "Bearer nope"})).status_code == 401
    assert (await ver(c, "123456", h={})).status_code == 401


async def test_happy_path_and_single_use(ctx):
    c, sender, _ = ctx
    _, ha = await mk(c, "proj")
    assert (await req(c, h=ha)).status_code == 202
    code = sender.codes["a@b.com"]
    assert re.fullmatch(r"\d{6}", code)
    assert sender.names["a@b.com"] == "pygmy"
    assert (await ver(c, code, email="A@b.com", h=ha)).json() == {"verified": True}
    assert (await ver(c, code, h=ha)).status_code == 400


async def test_web_key_works_via_x_api_key(ctx):
    c, _, _ = ctx
    r = await req(c, h={"X-API-Key": WEB_KEY})
    assert r.status_code == 202


async def test_custom_app_name(ctx):
    c, sender, _ = ctx
    _, ha = await mk(c, "proj")
    await req(c, h=ha, app_name="Meu App")
    assert sender.names["a@b.com"] == "Meu App"


async def test_projects_are_isolated(ctx):
    c, sender, _ = ctx
    _, ha = await mk(c, "a")
    _, hb = await mk(c, "b")
    await req(c, h=ha)
    code = sender.codes["a@b.com"]
    assert (await ver(c, code, h=hb)).status_code == 400
    assert (await ver(c, code, h=ha)).status_code == 200


async def test_wrong_code_then_lockout(ctx):
    c, sender, _ = ctx
    _, ha = await mk(c, "a")
    await req(c, h=ha)
    good = sender.codes["a@b.com"]
    bad = "000000" if good != "000000" else "111111"
    assert (await ver(c, bad, h=ha)).status_code == 400
    assert (await ver(c, bad, h=ha)).status_code == 400
    assert (await ver(c, bad, h=ha)).status_code == 429
    assert (await ver(c, good, h=ha)).status_code == 400  # burned


async def test_cooldown_per_project(ctx):
    c, _, _ = ctx
    _, ha = await mk(c, "a")
    _, hb = await mk(c, "b")
    assert (await req(c, h=ha)).status_code == 202
    assert (await req(c, h=ha)).status_code == 429
    assert (await req(c, h=hb)).status_code == 202


# --- Admin -----------------------------------------------------------------
async def test_admin_requires_key(ctx):
    c, _, _ = ctx
    assert (await c.get("/admin/keys")).status_code == 401
    assert (await c.get("/admin/keys", headers={"X-Admin-Key": "x" * 40})).status_code == 401
    assert (await c.get("/admin/keys", headers=AH)).status_code == 200


async def test_admin_disabled_when_unset(ctx, monkeypatch):
    c, _, _ = ctx
    monkeypatch.setattr(settings, "pygmy_admin_key", "")
    assert (await c.get("/admin/keys", headers=AH)).status_code == 404


async def test_key_lifecycle(ctx):
    c, sender, _ = ctx
    kid, h = await mk(c, "Loja")
    secret = h["Authorization"][7:]
    assert secret.startswith("pyg_")

    listing = (await c.get("/admin/keys", headers=AH)).json()["keys"]
    names = [k["name"] for k in listing]
    assert "Loja" in names and "Site (demo)" in names
    assert secret not in str(listing)  # secret is never listed

    # disable -> 401, enable -> works
    await c.patch(f"/admin/keys/{kid}", json={"enabled": False}, headers=AH)
    assert (await req(c, h=h)).status_code == 401
    await c.patch(f"/admin/keys/{kid}", json={"enabled": True, "name": "Loja 2"}, headers=AH)
    assert (await req(c, h=h)).status_code == 202

    # usage stats
    code = sender.codes["a@b.com"]
    await ver(c, code, h=h)
    await ver(c, "000000", h=h)
    k = next(k for k in (await c.get("/admin/keys", headers=AH)).json()["keys"] if k["id"] == kid)
    assert k["name"] == "Loja 2"
    assert k["totals"] == {"sent": 1, "ok": 1, "fail": 1}
    assert k["daily"][-1]["sent"] == 1 and k["last_used"]

    # rotate -> old key dies, new works
    r = (await c.post(f"/admin/keys/{kid}/rotate", headers=AH)).json()
    new = {"Authorization": f"Bearer {r['secret']}"}
    assert r["secret"] != secret
    assert (await req(c, "z@z.com", h=h)).status_code == 401
    assert (await req(c, "z@z.com", h=new)).status_code == 202

    # delete
    assert (await c.delete(f"/admin/keys/{kid}", headers=AH)).status_code == 204
    assert (await req(c, "y@y.com", h=new)).status_code == 401
    assert (await c.delete(f"/admin/keys/{kid}", headers=AH)).status_code == 404


async def test_admin_validation(ctx):
    c, _, _ = ctx
    assert (await c.post("/admin/keys", json={"name": "  "}, headers=AH)).status_code == 422
    assert (await c.patch("/admin/keys/nope", json={"enabled": False}, headers=AH)).status_code == 404
    assert (await c.delete("/admin/keys/bad-id!", headers=AH)).status_code == 404
