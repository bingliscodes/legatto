import uuid
from fastapi import Request, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User


def get_current_user(request: Request, db: Session = Depends(get_db)) -> uuid.UUID:
    # 1. Read the cookie
    session_id = request.session.get("user_id")

    if session_id:
        return uuid.UUID(session_id)

    new_user = User()
    db.add(new_user)
    db.commit(new_user)
    db.refresh()
    request.session["user_id"] = str(new_user.id)
    return new_user.id
