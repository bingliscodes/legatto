# the stem separator — the "work"
import uuid
from requests.exceptions import HTTPError

from app.database import SessionLocal
from app.separator import get_separator
from app.models.track import Track, TrackStatus
from app.celery_app import celery_app


class TrackTask(celery_app.Task):
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        db = SessionLocal()
        try:
            track = db.get(Track, uuid.UUID(args[0]))
            if track is not None:
                track.status = TrackStatus.failed
                db.commit()
        finally:
            db.close()


@celery_app.task(
    base=TrackTask,
    autoretry_for=(
        HTTPError,
    ),  # retry when RunPod throws a transient HTTP error (the 520)
    retry_backoff=True,  # exponential: ~1s, 2s, 4s… (gives the cold start time to warm)
    retry_backoff_max=60,  # cap the delay
    retry_jitter=True,  # spread retries so they don't sync up
    max_retries=3,
)
def stem_separator(track_id: str, input_key: str, output_prefix: str):
    """Creates a new file for each instrument"""
    db = SessionLocal()

    try:
        track = db.get(Track, uuid.UUID(track_id))
        if track is None:
            raise LookupError(f"Track {track_id} not found")
        track.status = TrackStatus.processing
        db.commit()

        # Processing work
        get_separator().separate(input_key, output_prefix)
        track.status = TrackStatus.completed
        db.commit()
    finally:
        db.close()
