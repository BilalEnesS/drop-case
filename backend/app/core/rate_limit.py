from fastapi import Request, HTTPException, status
from app.db.redis import get_redis
import time


async def rate_limit(
    request: Request,
    limit: int = 10,
    window: int = 60,
    key_prefix: str = "rate_limit",
    user_id: int | None = None
) -> None:
    # Get client identifier (user ID if provided, otherwise IP)
    if user_id is not None:
        client_id = f"user_{user_id}"
    else:
        client_id = request.client.host if request.client else "unknown"
    
    redis_key = f"{key_prefix}:{client_id}"
    
    try:
        redis_client = await get_redis()
        if redis_client is None:
            # Redis unavailable - allow request (fail open)
            return
        
        # Get current timestamp
        now = time.time()
        
        # Remove old entries outside the window
        cutoff = now - window
        
        # Use sorted set for sliding window
        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(redis_key, 0, cutoff)
        pipe.zcard(redis_key)
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, window)
        results = await pipe.execute()
        
        current_count = results[1]
        
        # Check if limit exceeded
        if current_count >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {limit} requests per {window} seconds"
            )
    
    except HTTPException:
        raise
    except Exception:
        # If Redis is unavailable, allow request (fail open)
        # In production, you might want to log this
        pass


def create_rate_limit_dependency(limit: int = 10, window: int = 60, key_prefix: str = "rate_limit", use_user: bool = False):
    if use_user:
        # User-based rate limiting
        # Note: user should be provided by the endpoint's dependency injection
        # We'll accept it as a parameter that FastAPI will inject
        async def rate_limit_dep(request: Request, user) -> None:
            # user will be injected by FastAPI from the endpoint's dependencies
            user_id = user.id if user else None
            await rate_limit(request, limit=limit, window=window, key_prefix=key_prefix, user_id=user_id)
        
        return rate_limit_dep
    else:
        # IP-based rate limiting
        async def rate_limit_dep(request: Request) -> None:
            await rate_limit(request, limit=limit, window=window, key_prefix=key_prefix, user_id=None)
        return rate_limit_dep

