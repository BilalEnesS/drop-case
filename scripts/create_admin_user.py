#!/usr/bin/env python3
# Script to create admin user

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.db.session import get_session
from app.repositories.user_repo import get_user_by_email, create_user
from app.core.security import hash_password


async def main():
    email = "admin@example.com"
    password = "admin123"
    
    async for db in get_session():
        # Check if user exists
        existing = await get_user_by_email(db, email)
        if existing:
            # Update to admin role
            existing.role = "admin"
            existing.password_hash = hash_password(password)
            await db.commit()
            print(f"✓ Admin user updated: {email}")
        else:
            # Create new admin user
            password_hash = hash_password(password)
            user = await create_user(db, email, password_hash, "admin")
            await db.commit()
            print(f"✓ Admin user created: {email}")
        break


if __name__ == "__main__":
    asyncio.run(main())

