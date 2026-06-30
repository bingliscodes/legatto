from redis import Redis
from rq import Queue

from app.config import settings

# Create Redis connection
redis_client = Redis.from_url(settings.redis_url)
task_queue = Queue(connection=redis_client)
