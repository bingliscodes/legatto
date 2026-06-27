from fastapi import UploadFile, APIRouter, status, Response

router = APIRouter(prefix="/jobs")


def stem_separator(input_path: str, output_directory: str):
    """Creates a new file for each instrument"""
    for instrument in ["drums, bass, vocals, other, guitar, piano"]:
        open(f"{output_directory}/{instrument}_stem", "x")


# GET /jobs{job_id}
