import os
from dotenv import load_dotenv


# Load environment variables from .env if present
load_dotenv()


class Settings:
    # Core settings
    APP_NAME: str = os.getenv("APP_NAME", "DropSpot API")
    ENV: str = os.getenv("ENV", "development")

    # Database (PostgreSQL URI or SQLite fallback)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./data.db",
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    
    # Priority Score (from seed)
    PRIORITY_SEED: str = os.getenv("PRIORITY_SEED", "9c3f8b92f408")
    PRIORITY_COEFF_A: int = int(os.getenv("PRIORITY_COEFF_A", "8"))
    PRIORITY_COEFF_B: int = int(os.getenv("PRIORITY_COEFF_B", "13"))
    PRIORITY_COEFF_C: int = int(os.getenv("PRIORITY_COEFF_C", "4"))
    
    # AI Configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")


settings = Settings()


