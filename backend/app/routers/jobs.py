from fastapi import APIRouter, status, Response
from rq.job import Job
from rq.exceptions import NoSuchJobError

from app.queue import redis_client

router = APIRouter(prefix="/jobs")


@router.get("/{job_id}")
def get_job_by_id(job_id: str) -> Job:
    try:
        job = Job.fetch(job_id, redis_client)
        return job

    except NoSuchJobError:
        print(f"Job {job_id} does not exist or has expired in Redis.")
