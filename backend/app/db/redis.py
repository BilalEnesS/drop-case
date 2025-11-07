import redis.asyncio as redis
from app.core.config import settings
from typing import Optional


_redis_client: Optional[redis.Redis] = None


async def get_redis() -> Optional[redis.Redis]:
    # Lazy connection with timeout - returns None if Redis unavailable
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2
            )
            # Test connection
            await _redis_client.ping()
        except Exception:
            # Redis unavailable - fail open
            _redis_client = None
            return None
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None

