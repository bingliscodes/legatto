# the stem separator — the "work"
from pathlib import Path
import uuid

from app.database import SessionLocal
from app.separator import get_separator
from app.models.track import Track, TrackStatus
from app.celery_app import celery_app


@celery_app.task
def stem_separator(track_id: str, input_path: str, output_directory: str):
    """Creates a new file for each instrument"""
    db = SessionLocal()
    try:
        track = db.get(Track, uuid.UUID(track_id))
        if track is None:
            raise LookupError(f"Track {track_id} not found")
        try:
            track.status = TrackStatus.processing
            db.commit()

            # Processing work
            get_separator().separate(Path(input_path), Path(output_directory))

            track.status = TrackStatus.completed
            db.commit()
        except Exception:
            track.status = TrackStatus.failed
            db.commit()
            raise
    finally:
        db.close()
