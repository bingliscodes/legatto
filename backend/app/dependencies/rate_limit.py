from fastapi import Request, HTTPException
from redis.asyncio import Redis

from app.config import settings

# One shared async Redis client for the whole API process. `from_url` builds a
# connection pool under the hood, so this is safe to reuse across requests.
# (Same Redis instance Celery already uses — Redis is already critical-path, so
# coupling uploads to it is fine: no Redis => no job processing anyway.)
redis_client = Redis.from_url(settings.redis_url, decode_responses=True)


async def hit(
    key: str,
    limit: int,
    window_seconds: int,
    *,
    detail="Too many uploads. Please try again later.",
    status_code=429,
) -> None:
    """Fixed-window rate limit for one counter.

    INCR the key (creates it at 1 if new). On that FIRST hit we set the TTL, so
    the window is measured from the first request and resets cleanly when it
    expires.
    Once the count passes limit, reject with 429 + a Retry-After telling them when the window frees.

    Note: rejected requests still INCR, so hammering keeps you locked out for the
    window — that's intentional. (INCR-then-EXPIRE isn't atomic; a crash in the
    ~microsecond gap could strand a key without a TTL. Negligible here; a Lua
    script / pipeline is the bulletproof version if we ever want it.)
    """
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, window_seconds)
    if count > limit:
        retry_after = await redis_client.ttl(key)
        raise HTTPException(
            status_code=status_code,
            detail=detail,
            headers={"Retry-After": str(max(retry_after, 1))},
        )


async def rate_limit_upload(request: Request) -> None:
    """Per-IP upload throttle. Applied as a dependency on POST /tracks.

    `request.client.host` is the real client IP *only* once uvicorn is told to
    trust the proxy (`--forwarded-allow-ips`); otherwise it's nginx's IP and the
    limit becomes global-by-accident. See the Dockerfile change.
    """
    ip = request.client.host if request.client else "unknown"

    await hit(f"rl:upload:h:{ip}", settings.upload_rate_per_hour, 3600)
    await hit(f"rl:upload:d:{ip}", settings.upload_rate_per_day, 86400)
