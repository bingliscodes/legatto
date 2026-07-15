import uuid
from fastapi import Request, Depends
from sqlalchemy.orm import Session
from redis import Redis
from datetime import datetime, timezone

from app.config import settings
from app.database import get_db
from app.models.user import User

redis_client = Redis.from_url(settings.redis_url, decode_responses=True)


def get_current_user_id(request: Request, db: Session = Depends(get_db)) -> uuid.UUID:
    session_id = request.session.get("user_id")
    redis_client.sadd(f"active:{datetime.now(timezone.utc).date()}", str(session_id))

    if session_id:
        return uuid.UUID(session_id)

    new_user = User()
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    request.session["user_id"] = str(new_user.id)
    return new_user.id
