from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://redis:6379/0"

    # Key used by the bundled website demo (built-in client "web").
    pygmy_web_key: str = ""
    # Secret that authorizes /admin/* (credential management). Disabled when empty.
    pygmy_admin_key: str = ""

    # Secret used to HMAC the OTP codes before storing them. MUST be set in prod.
    otp_secret: str = "change-me"
    otp_length: int = 6
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60
    # Max codes requested per hour, per (project, e-mail) and per (project, end-user IP).
    # The IP limit only applies when the caller sends X-End-User-IP.
    otp_max_requests_per_hour: int = 5
    otp_max_requests_per_hour_per_ip: int = 20

    # "smtp" sends real e-mail; "console" only logs the code (dev only!)
    otp_sender: str = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    # Defaults to SMTP_USER. Hostinger only accepts the authenticated mailbox as sender.
    # Display name is allowed: "pygmy <no-reply@seudominio.com>"
    smtp_from: str = ""
    smtp_use_ssl: bool = False  # True = implicit TLS (port 465); False = STARTTLS
    email_subject: str = "Seu código de verificação"
    app_name: str = "pygmy"  # default brand in the e-mail; callers may override per request

settings = Settings()
