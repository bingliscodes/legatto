from fastapi import UploadFile, APIRouter, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import uuid4
from pathlib import Path
import uuid
import io
from datetime import datetime, timezone
from mutagen import File as MutagenFile

from app.storage import get_storage
from app.tasks import stem_separator
from app.config import STORAGE_ROOT, ALLOWED_UPLOAD_EXTENSIONS
from app.config import settings
from app.database import get_db
from app.models.track import Track
from app.schemas.track import TrackResponse, TrackDetailResponse, TrackStatus
from app.dependencies.auth import get_current_user_id
from app.dependencies.rate_limit import rate_limit_upload, hit

router = APIRouter(prefix="/tracks")

storage = get_storage()


@router.get("/", response_model=list[TrackResponse])
def get_tracks(
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    """Returns all tracks for the current user, sorted by created_at (newest first)
    TODO: Add pagination/.limit()
    """
    stmt = (
        select(Track).where(Track.user_id == user_id).order_by(Track.created_at.desc())
    )
    return db.execute(stmt).scalars().all()


@router.post(
    "/", response_model=TrackResponse, dependencies=[Depends(rate_limit_upload)]
)
async def process_audio(
    audio_file: UploadFile,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Takes in an audio file, creates track id, initialize directory, save to disk, drop the job in the queue, return job id"""
    track_id = str(uuid4())

    data = await audio_file.read()
    ext = Path(audio_file.filename or "").suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            400, detail="Unsupported format. Upload MP3, WAV, FLAC, M4A, or OGG."
        )
    # ––– Duration guard –––
    bio = io.BytesIO(data)
    bio.name = audio_file.filename or ""
    audio = MutagenFile(bio)

    duration = getattr(audio.info, "length", None) if audio is not None else None
    if duration is None:
        raise HTTPException(
            status_code=400,
            detail="Error processing uploaded file. Please ensure it is a supported audio file type (MP3, WAV, FLAC, M4A, OGG).",
        )
    if duration > settings.max_audio_duration_seconds:
        raise HTTPException(
            status_code=422,
            detail=f"Audio exceeds the {settings.max_audio_duration_seconds // 60}-minute limit",
        )
    await hit(
        key=f"rl:global:day:{datetime.now(timezone.utc).date()}",
        limit=settings.global_daily_cap,
        window_seconds=86400,
        detail="Service temporarily unavailable. Please try again later",
        status_code=503,
    )

    input_key = f"{track_id}/{Path(audio_file.filename).name}"
    output_prefix = f"{track_id}/stems/"
    storage.write_file(input_key, data)

    # Create new track in DB before enqueuing task
    new_track = Track(id=track_id, user_id=user_id, display_name=audio_file.filename)
    db.add(new_track)
    db.commit()
    db.refresh(new_track)  # Get latest record from DB

    stem_separator.apply_async(
        args=[track_id, input_key, output_prefix], task_id=track_id
    )
    return new_track


@router.get("/{track_id}", response_model=TrackDetailResponse)
def get_track(
    track_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    track = db.get(Track, uuid.UUID(track_id))

    if not track or track.user_id != user_id:
        raise HTTPException(status_code=404)
    stems = {}
    if track.status == TrackStatus.completed:
        for file_name in storage.list_stems(track_id):
            stems[Path(file_name).stem] = (
                storage.url_for(f"{track_id}/stems/{file_name}")
                or f"/tracks/{track_id}/stems/{file_name}"
            )

    return TrackDetailResponse(
        **TrackResponse.model_validate(track).model_dump(), stems=stems
    )


@router.get("/{track_id}/stems/{filename}")
def get_stem(track_id: str, filename: str):
    """
    Since prod uses presigned URLs and get_stem isn't involved there's
    no real risk and leaving this route unfiltered for users.
    """
    try:
        file_bytes = storage.open(f"{track_id}/stems/{filename}")
        return Response(content=file_bytes, media_type="audio/wav")
    except FileNotFoundError:
        raise HTTPException(status_code=404)
