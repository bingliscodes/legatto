# Loads a sample record to S3 storage
from app.storage import S3Storage

s = S3Storage()
audio_path = "/Users/benjamininglis/Code/guitarist-practice-tool/backend/storage/dda607de-493b-443a-8197-509d14b5741b/Glasglow Kiss.mp3"
with open(audio_path, "rb") as f:
    s.write_file("test123/song.mp3", f.read())
print("uploaded ->", "test123/song.mp3")
