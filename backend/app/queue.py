from redis import Redis
from rq import Queue
import os

# Create Redis connection
url = os.environ["REDIS_URL"]
redis_client = Redis.from_url(url, decode_response=True)
task_queue = Queue(connection=redis_client)
