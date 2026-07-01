from fastapi import UploadFile, APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import uuid4
from pathlib import Path
import uuid

from app.queue import task_queue
from app.tasks import stem_separator
from app.config import STORAGE_ROOT
from app.database import get_db
from app.models.track import Track
from app.schemas.track import TrackResponse, TrackDetailResponse, TrackStatus

router = APIRouter(prefix="/tracks")


async def save_file_to_disk(file: UploadFile, job_dir) -> Path:
    contents = await file.read()

    destination_path = job_dir / file.filename

    destination_path.write_bytes(contents)

    return destination_path


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

    job_dir = STORAGE_ROOT / track_id
    job_dir.mkdir(parents=True, exist_ok=True)

    input_path = await save_file_to_disk(audio_file, job_dir)
    stems_path = job_dir / "stems"
    stems_path.mkdir(parents=True, exist_ok=True)

    # Create new track in DB before enqueuing task
    new_track = Track(id=track_id, display_name=audio_file.filename)
    db.add(new_track)
    db.commit()
    db.refresh(new_track)  # Get latest record from DB
    task_queue.enqueue(
        stem_separator, track_id, input_path, stems_path, job_id=track_id
    )
    return new_track


@router.get("/{track_id}", response_model=TrackDetailResponse)
def get_track(track_id: str, db: Session = Depends(get_db)):
    track = db.get(Track, uuid.UUID(track_id))

    if not track:
        raise HTTPException(status_code=404)
    stems = {}
    if track.status == TrackStatus.completed:
        print("here")
        stems_dir = (STORAGE_ROOT / track_id / "stems").resolve()
        for file_path in sorted(stems_dir.glob("*.wav")):
            if file_path.is_file():
                stems[file_path.stem] = f"/tracks/{track_id}/stems/{file_path.name}"

    return TrackDetailResponse(
        **TrackResponse.model_validate(track).model_dump(), stems=stems
    )


@router.get("/{track_id}/stems/{filename}")
def get_stem(track_id: str, filename: str):
    stems_dir = (STORAGE_ROOT / track_id / "stems").resolve()
    path = (stems_dir / filename).resolve()
    if not path.is_relative_to(stems_dir) or not path.is_file():
        raise HTTPException(status_code=404)

    return FileResponse(path)
