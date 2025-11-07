from typing import Optional, Any
from app.db.redis import get_redis
import json
import hashlib


def _make_cache_key(key: str) -> str:
    # Create a cache key with prefix
    return f"cache:{key}"


async def get_cache(key: str) -> Optional[Any]:
    try:
        redis_client = await get_redis()
        if redis_client is None:
            return None
        cache_key = _make_cache_key(key)
        value = await redis_client.get(cache_key)
        if value:
            return json.loads(value)
    except Exception:
        # If Redis fails, return None (fail open)
        pass
    return None


async def set_cache(key: str, value: Any, ttl: int = 300) -> None:
    try:
        redis_client = await get_redis()
        if redis_client is None:
            return
        cache_key = _make_cache_key(key)
        await redis_client.setex(
            cache_key,
            ttl,
            json.dumps(value, default=str)
        )
    except Exception:
        # If Redis fails, silently continue (fail open)
        pass


async def invalidate_cache(key_pattern: str) -> None:
    try:
        redis_client = await get_redis()
        if redis_client is None:
            return
        cache_pattern = _make_cache_key(key_pattern)
        keys = await redis_client.keys(cache_pattern)
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        pass


def make_cache_key_from_params(prefix: str, **params) -> str:
    # Sort params for consistent key generation
    sorted_params = sorted(params.items())
    params_str = "&".join(f"{k}={v}" for k, v in sorted_params)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
    return f"{prefix}:{params_hash}"

