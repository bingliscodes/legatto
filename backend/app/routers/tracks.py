from fastapi import UploadFile, APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import uuid4
from pathlib import Path

from app.queue import task_queue
from app.tasks import stem_separator
from app.config import STORAGE_ROOT
from app.database import get_db
from app.models.track import Track
from app.schemas.track import TrackResponse

router = APIRouter(prefix="/tracks")


async def save_file_to_disk(file: UploadFile, job_dir) -> Path:
    contents = await file.read()

    destination_path = job_dir / file.filename

    destination_path.write_bytes(contents)

    return destination_path


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
    db.refresh(new_track)
    task_queue.enqueue(
        stem_separator, track_id, input_path, stems_path, job_id=track_id
    )
    return new_track


@router.get("/{track_id}/stems/{filename}")
def get_stem(track_id: str, filename: str):
    stems_dir = (STORAGE_ROOT / track_id / "stems").resolve()
    path = (stems_dir / filename).resolve()
    if not path.is_relative_to(stems_dir) or not path.is_file():
        raise HTTPException(status_code=404)

    return FileResponse(path)
