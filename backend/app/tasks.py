# the stem separator — the "work"
from pathlib import Path
from demucs.api import Separator, save_audio

_separator = None


def get_separator():
    global _separator
    if _separator is None:
        _separator = Separator(model="htdemucs_6s", device="mps")
    return _separator


def stem_separator(input_path: str, output_directory: str):
    """Creates a new file for each instrument"""
    separator = get_separator()
    origin, stems = separator.separate_audio_file(input_path)

    for name, tensor in stems:
        save_audio(
            tensor,
            (Path(output_directory) / f"{name}.wav"),
            samplerate=separator.samplerate,
        )
