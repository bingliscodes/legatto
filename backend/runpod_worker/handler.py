import os, tempfile
from pathlib import Path
import runpod, boto3, torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import AudioFile, save_audio

s3 = boto3.client(
    "s3",
    endpoint_url=os.environ["SPACES_ENDPOINT"],
    region_name=os.environ["SPACES_REGION"],
    aws_access_key_id=os.environ["SPACES_KEY"],
    aws_secret_access_key=os.environ["SPACES_SECRET"],
)
BUCKET = os.environ["SPACES_BUCKET"]

_model = None


def get_cuda_model():
    global _model
    if _model is None:
        _model = get_model("htdemucs_6s").to("cuda").eval()
    return _model


def handler(event):
    job_input = event["input"]
