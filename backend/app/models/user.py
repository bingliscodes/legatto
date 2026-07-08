from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
import uuid
from datetime import datetime

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    google_identity: Mapped[str | None] = mapped_column(unique=True)
