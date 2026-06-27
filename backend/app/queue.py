from redis import Redis
from rq import Queue
import os
from dotenv import load_dotenv

load_dotenv()

# Create Redis connection
url = os.getenv("REDIS_URL")
redis_client = Redis.from_url(url)
task_queue = Queue(connection=redis_client)
