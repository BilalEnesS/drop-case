from fastapi import FastAPI
from .routers import health
from app.routers import auth
from app.routers import drop as drop_router
from app.routers import admin as admin_router
from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
from starlette.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
	# Minimal FastAPI app factory
	app = FastAPI(title="DropSpot API", version="0.1.0")

	# CORS for frontend dev
	app.add_middleware(
		CORSMiddleware,
		allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"]
	)

	# Routers (more specific routes first)
	app.include_router(health.router, prefix="/health", tags=["health"]) 
	app.include_router(auth.router)
	app.include_router(admin_router.router)  # /admin/drops must come before /drops
	app.include_router(drop_router.router)

	@app.on_event("startup")
	async def on_startup() -> None:
		# Dev-only: auto-create tables
		if settings.ENV == "development":
			# Ensure models are imported so metadata has all tables
			from app import models  # noqa: F401
			async with engine.begin() as conn:
				await conn.run_sync(Base.metadata.create_all)

	return app


app = create_app()

# Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


