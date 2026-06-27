from fastapi import UploadFile, APIRouter, status, Response
from pathlib import Path

from app.queue import redis_client, task_queue
from app.tasks import stem_separator
import os

router = APIRouter(prefix="/tracks")

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/")
async def proccess_audio(audio_file: UploadFile):
    """Takes in an audio file, save to disk, drop the job in the queue, return job id"""
    input_path = await save_file_to_disk(audio_file)
    job = task_queue.enqueue(stem_separator, input_path, os.getenv("STORAGE_DIR"))
    return job.id


async def save_file_to_disk(file: UploadFile) -> str:
    contents = await file.read()

    destination_path = UPLOAD_DIR / file.filename

    with open(destination_path, "wb") as f:
        f.write(contents)

    return destination_path
