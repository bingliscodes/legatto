# the stem separator — the "work"
from pathlib import Path


def stem_separator(input_path: str, output_directory: str):
    """Creates a new file for each instrument"""

    for instrument in ["drums", "bass", "vocals", "other", "guitar", "piano"]:
        Path(output_directory) / f"{instrument}_stem".write_text("placeholder")
