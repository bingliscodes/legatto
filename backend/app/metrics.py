import uuid
from redis import Redis
from datetime import datetime, timezone, timedelta

from app.database import SessionLocal
from app.config import settings
from app.models import DailyActiveUser

redis_client = Redis.from_url(settings.redis_url, decode_responses=True)


def mark_active(user_id: uuid.UUID | str) -> None:
    key = f"active:{datetime.now(timezone.utc).date()}"
    redis_client.sadd(key, str(user_id))
    redis_client.expire(key, 60 * 60 * 24 * 3, nx=True)


def snapshot_active_users() -> DailyActiveUser:
    db = SessionLocal()

    try:
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        daily_users = redis_client.scard(f"active:{yesterday}")

        new_row = DailyActiveUser(date=yesterday, count=daily_users)
        db.add(new_row)
        db.commit()
        return daily_users

    finally:
        db.close()
