from redis import Redis
from rq import Queue
import os

# Create Redis connection
redis_conn = Redis(os.environ["REDIS_URL"])
q = Queue(connection=redis_conn)
