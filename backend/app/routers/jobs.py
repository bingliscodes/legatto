from fastapi import APIRouter, HTTPException
from rq.job import Job
from rq.exceptions import NoSuchJobError
from pydantic import BaseModel

from app.queue import redis_client

router = APIRouter(prefix="/jobs")


class JobStatus(BaseModel):
    id: str
    status: str


@router.get("/{job_id}")
def get_job_by_id(job_id: str) -> JobStatus:
    try:
        job = Job.fetch(job_id, redis_client)
        return JobStatus(id=job.id, status=job.get_status())

    except NoSuchJobError:
        raise HTTPException(
            status_code=404,
            details=f"Job {job_id} does not exist or has expired in Redis.",
        )
