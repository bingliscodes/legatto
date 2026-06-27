from fastapi import UploadFile


def stem_separator(input_path: str, output_directory: str):
    """Creates a new file for each instrument"""
    for instrument in ["drums, bass, vocals, other, guitar, piano"]:
        open(f"{output_directory}/{instrument}_stem", "x")
