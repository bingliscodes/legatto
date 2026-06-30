# the stem separator — the "work"
from pathlib import Path
from app.database import SessionLocal
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import AudioFile, save_audio
import torch


from app.config import settings


from app.config import SHIFTS, OVERLAP

model = None


def get_demucs_model():
    global model
    if model is None:
        model = get_model("htdemucs_6s")
        model.to("mps")
        model.eval()
    return model


def stem_separator(track_id: str, input_path: str, output_directory: str):
    """Creates a new file for each instrument"""
    db = SessionLocal()
    model = get_demucs_model()
    wav = AudioFile(input_path).read(
        streams=0, samplerate=model.samplerate, channels=model.audio_channels
    )
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()  # demucs normalizes by the mix's mean/std

    with torch.no_grad():
        sources = apply_model(
            model, wav[None], device="mps", shifts=SHIFTS, overlap=OVERLAP
        )[
            0
        ]  # wav[None] adds a batch dim

    sources = sources * ref.std() + ref.mean()  # un-normalize

    for name, source in zip(
        model.sources, sources
    ):  # model.sources == the 6 stem names
        save_audio(
            source,
            str(Path(output_directory) / f"{name}.wav"),
            samplerate=model.samplerate,
        )
