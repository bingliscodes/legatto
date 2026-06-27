from fastapi import UploadFile, APIRouter
from uuid import uuid4
from pathlib import Path

from app.queue import redis_client, task_queue
from app.tasks import stem_separator
from app.config import STORAGE_ROOT

router = APIRouter(prefix="/tracks")


@router.post("/")
async def proccess_audio(audio_file: UploadFile):
    """Takes in an audio file, creates track id, initialize directory, save to disk, drop the job in the queue, return job id"""
    track_id = uuid4().hex
    job_dir = STORAGE_ROOT / track_id
    job_dir.mkdir(parents=True, exist_ok=True)

    input_path = await save_file_to_disk(audio_file, job_dir)
    stems_path = job_dir / "stems"
    stems_path.mkdir(parents=True, exist_ok=True)

    job = task_queue.enqueue(stem_separator, input_path, stems_path, job_id=track_id)
    return track_id


async def save_file_to_disk(file: UploadFile, job_dir) -> Path:
    contents = await file.read()

    destination_path = job_dir / file.filename

    destination_path.write_bytes(contents)

    return destination_path
