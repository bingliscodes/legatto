from pydantic import BaseModel, ConfigDict
from app.models.track import TrackStatus
import uuid
from datetime import datetime


class TrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str
    artist: str | None
    status: TrackStatus
    created_at: datetime
    is_demo: bool


class TrackDetailResponse(TrackResponse):
    stems: dict[str, str]
