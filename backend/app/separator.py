from abc import ABC, abstractmethod
from pathlib import Path
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import AudioFile, save_audio
import torch

from app.config import settings, SHIFTS, OVERLAP


class Separator(ABC):

    @abstractmethod
    def get_demucs_model(self):
        raise NotImplementedError

    @abstractmethod
    def separate(
        self, input_path: Path, output_dir: Path
    ) -> list[str]:  # returns stem names written
        raise NotImplementedError


class LocalSeparator(Separator):
    def __init__(self, device: str):
        self.device = device
        self.model = get_model("htdemucs_6s").to(self.device).eval()

    def separate(self, input_path: Path, output_dir: Path) -> list[str]:
        wav = AudioFile(input_path).read(
            streams=0,
            samplerate=self.model.samplerate,
            channels=self.model.audio_channels,
        )
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()  # demucs normalizes by the mix's mean/std

        with torch.no_grad():
            sources = apply_model(
                self.model,
                wav[None],
                device="mps",
                shifts=SHIFTS,
                overlap=OVERLAP,
            )[
                0
            ]  # wav[None] adds a batch dim

        sources = sources * ref.std() + ref.mean()  # un-normalize

        for name, source in zip(
            self.model.sources, sources
        ):  # model.sources == the 6 stem names
            save_audio(
                source,
                str(Path(output_dir) / f"{name}.wav"),
                samplerate=self.model.samplerate,
            )
        return list(self.model.sources)


_separator: Separator | None = None


def get_separator() -> Separator:
    global _separator
    if _separator is None:
        _separator = LocalSeparator(device=settings.device)
    return _separator
