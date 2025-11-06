from fastapi import APIRouter


router = APIRouter()


@router.get("/live")
def live() -> dict:
	# Liveness probe
	return {"status": "ok"}


@router.get("/ready")
def ready() -> dict:
	# Readiness probe (extend with DB/Redis checks later)
	return {"status": "ready"}


