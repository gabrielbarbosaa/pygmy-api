import asyncio
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from string import Template
from typing import Protocol

from .config import Settings

log = logging.getLogger("otp.sender")

_TEMPLATE = Template(
    (Path(__file__).parent / "templates" / "otp_email.html").read_text(encoding="utf-8")
)


def render_html(app_name: str, subject: str, code: str, ttl_minutes: int) -> str:
    name = html.escape(app_name)
    return _TEMPLATE.substitute(
        app_name=name,
        app_initial=html.escape((app_name.strip() or "O")[0].upper()),
        subject=html.escape(subject),
        code=html.escape(code),
        ttl_minutes=ttl_minutes,
    )


class Sender(Protocol):
    async def send(self, to: str, code: str, ttl_minutes: int, app_name: str) -> None: ...


class ConsoleSender:
    """Dev only: logs the code instead of sending it."""

    async def send(self, to: str, code: str, ttl_minutes: int, app_name: str) -> None:
        log.warning("[DEV] OTP for %s (%s): %s", to, app_name, code)


class SmtpSender:
    def __init__(self, s: Settings):
        self.s = s

    def _send_sync(self, to: str, code: str, ttl_minutes: int, app_name: str) -> None:
        s = self.s
        msg = EmailMessage()
        msg["Subject"] = s.email_subject
        msg["From"] = s.smtp_from or s.smtp_user
        msg["To"] = to
        msg.set_content(
            f"Seu código de verificação do {app_name} é: {code}\n\n"
            f"Ele expira em {ttl_minutes} minutos. "
            "Se você não solicitou, ignore este e-mail."
        )
        msg.add_alternative(
            render_html(app_name, s.email_subject, code, ttl_minutes),
            subtype="html",
        )
        ctx = ssl.create_default_context()
        if s.smtp_use_ssl:
            with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=ctx, timeout=15) as c:
                if s.smtp_user:
                    c.login(s.smtp_user, s.smtp_password)
                c.send_message(msg)
        else:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as c:
                c.starttls(context=ctx)
                if s.smtp_user:
                    c.login(s.smtp_user, s.smtp_password)
                c.send_message(msg)

    async def send(self, to: str, code: str, ttl_minutes: int, app_name: str) -> None:
        await asyncio.to_thread(self._send_sync, to, code, ttl_minutes, app_name)


def build_sender(s: Settings) -> Sender:
    if s.otp_sender == "smtp":
        if not s.smtp_host:
            raise RuntimeError("OTP_SENDER=smtp requires SMTP_HOST")
        return SmtpSender(s)
    return ConsoleSender()
