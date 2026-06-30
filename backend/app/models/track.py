from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
import uuid
import enum
from datetime import datetime

from app.database import Base


class TrackStatus(enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    display_name: Mapped[str]
    artist: Mapped[str | None]
    status: Mapped[TrackStatus] = mapped_column(default=TrackStatus.queued)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    user_id: Mapped[uuid.UUID | None]
