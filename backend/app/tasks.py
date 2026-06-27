# the stem separator — the "work"
def stem_separator(input_path: str, output_directory: str):
    """Creates a new file for each instrument"""
    for instrument in ["drums", "bass", "vocals", "other", "guitar", "piano"]:
        with open(f"{output_directory}/{instrument}_stem", "w") as f:
            f.write("Initial file setup complete.")
