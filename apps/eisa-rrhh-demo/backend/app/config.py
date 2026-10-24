from pathlib import Path
from urllib.parse import urlsplit

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
    database_path: Path = Path("/app/data/eisa_demo.db")
    static_path: Path = Path("/app/web")
    public_origin: str
    demo_username: str
    demo_password_hash: SecretStr
    session_secret: SecretStr
    foundry_openai_base_url: str = ""
    foundry_model_deployment: str = ""
    foundry_api_key: SecretStr = SecretStr("")
    foundry_auth_mode: str = "entra"
    foundry_json_mode: bool = True
    session_ttl_seconds: int = 28800

    @field_validator("public_origin")
    @classmethod
    def check_origin(cls, value):
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.path
            or parsed.query
            or parsed.fragment
            or parsed.username
        ):
            raise ValueError("PUBLIC_ORIGIN must be an HTTPS origin without a trailing slash")
        return value

    @model_validator(mode="after")
    def check_secrets(self):
        if len(self.session_secret.get_secret_value()) < 32:
            raise ValueError("SESSION_SECRET requires at least 32 characters")
        if not self.demo_password_hash.get_secret_value().startswith(("$2b$", "$2a$")):
            raise ValueError("DEMO_PASSWORD_HASH must be bcrypt")
        if not 60 <= self.session_ttl_seconds <= 28800:
            raise ValueError("Session TTL must be between 60 seconds and 8 hours")
        if self.foundry_auth_mode not in {"entra", "key"}:
            raise ValueError("FOUNDRY_AUTH_MODE must be entra or key")
        if self.foundry_openai_base_url:
            p = urlsplit(self.foundry_openai_base_url)
            if (
                p.scheme != "https"
                or not p.hostname
                or p.username
                or p.query
                or p.fragment
                or p.path != "/openai/v1/"
            ):
                raise ValueError("Foundry requires an HTTPS /openai/v1/ endpoint")
        return self

    def model_configured(self) -> bool:
        return bool(
            self.foundry_openai_base_url
            and self.foundry_model_deployment
            and (self.foundry_auth_mode == "entra" or self.foundry_api_key.get_secret_value())
        )
