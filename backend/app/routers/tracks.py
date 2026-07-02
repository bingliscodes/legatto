from fastapi import UploadFile, APIRouter, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import uuid4
from pathlib import Path
import uuid
from __future__ import annotations

from app.storage import get_storage
from app.tasks import stem_separator
from app.config import STORAGE_ROOT
from app.database import get_db
from app.models.track import Track
from app.schemas.track import TrackResponse, TrackDetailResponse, TrackStatus

router = APIRouter(prefix="/tracks")

storage = get_storage()


@router.get("/", response_model=list[TrackResponse])
def get_tracks(db: Session = Depends(get_db)):
    """Returns all tracks, sorted by created_at (newest first)
    TODO: Add pagination/.limit()
    """
    stmt = select(Track).order_by(Track.created_at.desc())
    return db.execute(stmt).scalars().all()


@router.post("/", response_model=TrackResponse)
async def process_audio(audio_file: UploadFile, db: Session = Depends(get_db)):
    """Takes in an audio file, creates track id, initialize directory, save to disk, drop the job in the queue, return job id"""
    track_id = str(uuid4())

    data = await audio_file.read()
    input_key = f"{track_id}/{audio_file.filename}"
    storage.write_file(input_key, data)

    input_path = STORAGE_ROOT / input_key
    stems_path = STORAGE_ROOT / track_id / "stems"

    # Create new track in DB before enqueuing task
    new_track = Track(id=track_id, display_name=audio_file.filename)
    db.add(new_track)
    db.commit()
    db.refresh(new_track)  # Get latest record from DB

    stem_separator.apply_async(
        args=[track_id, input_path, stems_path], task_id=track_id
    )

    return new_track


@router.get("/{track_id}", response_model=TrackDetailResponse)
def get_track(track_id: str, db: Session = Depends(get_db)):
    track = db.get(Track, uuid.UUID(track_id))

    if not track:
        raise HTTPException(status_code=404)
    stems = {}
    if track.status == TrackStatus.completed:
        for file_name in storage.list_stems(track_id):
            stems[Path(file_name).stem] = f"/tracks/{track_id}/stems/{file_name}"

    return TrackDetailResponse(
        **TrackResponse.model_validate(track).model_dump(), stems=stems
    )


@router.get("/{track_id}/stems/{filename}")
def get_stem(track_id: str, filename: str):
    try:
        file_bytes = storage.open(f"{track_id}/stems/{filename}")
        return Response(content=file_bytes, media_type="audio/wav")
    except FileNotFoundError:
        raise HTTPException(status_code=404)
