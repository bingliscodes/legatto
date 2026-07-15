import uuid
from redis import Redis
from datetime import datetime, timezone

from app.config import settings

redis_client = Redis.from_url(settings.redis_url, decode_responses=True)


def mark_active(user_id: uuid.UUID | str) -> None:
    key = f"active:{datetime.now(timezone.utc).date()}"
    redis_client.sadd(key, str(user_id))
    redis_client.expire(key, 60 * 60 * 24 * 3, nx=True)
