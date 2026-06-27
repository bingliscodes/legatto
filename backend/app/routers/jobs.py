from fastapi import UploadFile, APIRouter, status, Response

router = APIRouter(prefix="/jobs")


# GET /jobs{job_id}
