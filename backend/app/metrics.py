import uuid
from redis import Redis
from datetime import datetime, timezone, timedelta
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal
from app.config import settings
from app.models import DailyActiveUser

redis_client = Redis.from_url(settings.redis_url, decode_responses=True)


def mark_active(user_id: uuid.UUID | str) -> None:
    key = f"active:{datetime.now(timezone.utc).date()}"
    redis_client.sadd(key, str(user_id))
    redis_client.expire(key, 60 * 60 * 24 * 3, nx=True)


def snapshot_active_users() -> int:
    db = SessionLocal()

    try:
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        count = redis_client.scard(f"active:{yesterday}")

        stmt = (
            insert(DailyActiveUser)
            .values(record_date=yesterday, count=count)
            .on_conflict_do_update(
                index_elements=["record_date"],
                set_={"count": count},
            )
        )
        db.execute(stmt)
        db.commit()
        return count

    finally:
        db.close()
