from fastapi import APIRouter
from app.db.redis import get_redis
from app.db.session import engine
from sqlalchemy import text


router = APIRouter()


@router.get("/live")
def live() -> dict:
	# Liveness probe
	return {"status": "ok"}


@router.get("/ready")
async def ready() -> dict:
	# Readiness probe with DB and Redis checks
	checks = {
		"database": "unknown",
		"redis": "unknown"
	}
	
	# Check database
	try:
		async with engine.begin() as conn:
			await conn.execute(text("SELECT 1"))
		checks["database"] = "ok"
	except Exception:
		checks["database"] = "unavailable"
	
	# Check Redis
	try:
		redis_client = await get_redis()
		if redis_client is not None:
			await redis_client.ping()
			checks["redis"] = "ok"
		else:
			checks["redis"] = "unavailable"
	except Exception:
		checks["redis"] = "unavailable"
	
	# If database is unavailable, return not ready
	status = "ready" if checks["database"] == "ok" else "not_ready"
	
	return {
		"status": status,
		"checks": checks
	}


