from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime


class TrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
