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

    separator: str = "local"

    spaces_bucket: str = ""
    spaces_region: str = ""
    spaces_endpoint: str = ""
    spaces_key: str = ""
    spaces_secret: str = ""

    runpod_endpoint_id: str = ""
    runpod_api_key: str = ""

    shifts: int = 1
    overlap: float = 0.25

    session_secret: str
    session_https_only: bool = False

    max_audio_duration_seconds: int = 300

    upload_rate_per_hour: int = 10
    upload_rate_per_day: int = 30
    global_daily_cap: int = 65


settings = Settings()

# Kept as module-level names so existing imports keep working.
# STORAGE_ROOT derives from the (env-driven) storage_dir; SHIFTS/OVERLAP are
# static tuning constants, not env config, so they stay plain constants.
STORAGE_ROOT = Path(settings.storage_dir).resolve()
ALLOWED_UPLOAD_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg"}
SHIFTS = 1
OVERLAP = 0.25
