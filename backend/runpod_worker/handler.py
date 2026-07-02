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
SHIFTS = os.environ["SHIFTS"]
OVERLAP = os.environ["OVERLAP"]

_model = None


def get_cuda_model():
    global _model
    if _model is None:
        _model = get_model("htdemucs_6s").to("cuda").eval()
    return _model


def handler(event):
    model = get_cuda_model()
    job = event["input"]

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        input_key = job["input_key"]
        output_prefix = job["output_prefix"]
        file_name = Path(input_key).name
        local_input = tmp / file_name
        s3.download_file(Bucket=BUCKET, Key=input_key, Filename=str(local_input))

        local_stems = tmp / "stems"
        local_stems.mkdir(parents=True, exist_ok=True)

        wav = AudioFile(local_input).read(
            streams=0,
            samplerate=model.samplerate,
            channels=model.audio_channels,
        )
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()  # demucs normalizes by the mix's mean/std

        with torch.no_grad():
            sources = apply_model(
                model,
                wav[None],
                device="cuda",
                shifts=1,
                overlap=0.25,
            )[
                0
            ]  # wav[None] adds a batch dim

        sources = sources * ref.std() + ref.mean()  # un-normalize

        for name, source in zip(
            model.sources, sources
        ):  # model.sources == the 6 stem names
            save_audio(
                source,
                str(local_stems / f"{name}.wav"),
                samplerate=model.samplerate,
            )

        for file in local_stems.iterdir():
            s3.upload_file(file, Bucket=BUCKET, Key=str(output_prefix / f"{file.name}"))


runpod.serverless.start({"handler": handler})
