# the stem separator — the "work"
from pathlib import Path
from demucs.api import Separator, save_audio


def stem_separator(input_path: str, output_directory: str):
    """Creates a new file for each instrument"""
    separator = Separator(model="htdemucs_6s", device="mps")
    origin, stems = separator.separate_audio_file(input_path)

    for name, tensor in stems:
        save_audio(
            tensor,
            (Path(output_directory) / f"{name}.wav"),
            samplerate=separator.samplerate,
        )
