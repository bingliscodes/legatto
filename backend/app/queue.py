from redis import Redis
from rq import Queue
import os

# Create Redis connection
redis_conn = Redis(os.environ["REDIS_URL"])
task_queue = Queue(connection=redis_conn)
