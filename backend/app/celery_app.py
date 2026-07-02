from celery import Celery

from app.config import settings

celery_app = Celery("my_task_manager", broker=settings.redis_url, backend=settings.redis_url include=["app.tasks"])
