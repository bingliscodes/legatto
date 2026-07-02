from abc import ABC, abstractmethod
from pathlib import Path
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import AudioFile, save_audio
import torch
import runpod

from app.config import settings, STORAGE_ROOT


class Separator(ABC):

    @abstractmethod
    def separate(
        self, input_key: str, output_prefix: str
    ) -> list[str]:  # returns stem names written
        raise NotImplementedError


class LocalSeparator(Separator):
    def __init__(self, device: str):
        self.device = device
        self.model = get_model("htdemucs_6s").to(self.device).eval()

    def separate(self, input_key: str, output_prefix: str) -> list[str]:
        output_dir = (STORAGE_ROOT / output_prefix).resolve()
        input_path = (STORAGE_ROOT / input_key).resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
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
                device=self.device,
                shifts=settings.shifts,
                overlap=settings.overlap,
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


class RunPodSeparator(Separator):
    def __init__(self):
        runpod.api_key = settings.runpod_api_key
        self.endpoint = runpod.Endpoint(settings.runpod_endpoint_id)

    def separate(self, input_key: str, output_prefix: str) -> list[str]:
        payload = {"input_key": input_key, "output_prefix": output_prefix}
        res = self.endpoint.run_sync(payload, timeout=300)
        if not res or "stems" not in res:
            raise RuntimeError(f"RunPod separation failed: {res}")

        return res["stems"]


_separator: Separator | None = None


def get_separator() -> Separator:
    global _separator
    if _separator is None:
        if settings.separator == "runpod":
            _separator = RunPodSeparator()
        elif settings.separator == "local":
            _separator = LocalSeparator(device=settings.device)
        else:
            raise ValueError(f"unknown separator: {settings.separator}")
    return _separator
