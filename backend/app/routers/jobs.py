from fastapi import APIRouter, status, Response
from rq.job import Job
from app.queue import redis_conn

router = APIRouter(prefix="/jobs")


@router.get("/{job_id}")
def get_job_by_id(job_id: str) -> Job | None:
    job = Job.fetch(job_id, redis_conn)
    if not job:
        return None

    return job
