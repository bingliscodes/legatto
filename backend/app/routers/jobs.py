from fastapi import APIRouter, HTTPException
from rq.job import Job
from rq.exceptions import NoSuchJobError
from pydantic import BaseModel

from app.config import STORAGE_ROOT
from app.queue import redis_client

router = APIRouter(prefix="/jobs")


class JobStatus(BaseModel):
    id: str
    status: str
    stems: dict[str, str] | None = None


@router.get("/{job_id}")
def get_job_by_id(job_id: str) -> JobStatus:
    try:
        job = Job.fetch(job_id, redis_client)
        stems_dir = STORAGE_ROOT / job_id / "stems"
        stems = {
            file.stem: f"/tracks/{job_id}/stems/{file.name}"
            for file in stems_dir.glob("*.wav")
        }

        return JobStatus(id=job.id, status=job.get_status(), stems=stems)

    except NoSuchJobError:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} does not exist or has expired in Redis.",
        ) from None
