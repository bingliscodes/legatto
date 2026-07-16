from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "stem_separator_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"],
)

celery_app.conf.beat_schedule = {
    "nightly-dau-snapshot": {
        "task": "app.tasks.snapshot_dau",
        "schedule": crontab(hour=1, minute=0),  # 01:00 UTC daily
    },
}
