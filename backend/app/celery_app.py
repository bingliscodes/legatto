from app.config import settings

broker = settings.redis_url, include = ["app.tasks"]
