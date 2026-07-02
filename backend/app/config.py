from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-sourced config. Real env vars take precedence, then .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str
    storage_dir: str = "storage"

    device: str = "mps"

    storage_backend: str = (
        "local"  # "local" | "s3" — the selector get_storage() branches on
    )
    spaces_bucket: str = ""
    spaces_region: str = ""
    spaces_endpoint: str = ""
    spaces_key: str = ""
    spaces_secret: str = ""


settings = Settings()

# Kept as module-level names so existing imports keep working.
# STORAGE_ROOT derives from the (env-driven) storage_dir; SHIFTS/OVERLAP are
# static tuning constants, not env config, so they stay plain constants.
STORAGE_ROOT = Path(settings.storage_dir).resolve()
SHIFTS = 1
OVERLAP = 0.25
