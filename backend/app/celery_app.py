from celery import Celery

from app.config import settings

celery_app = Celery(
    "stem_separator_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"],
)
