#!/usr/bin/env python3
import asyncio
from app.db.session import get_session
from app.repositories.user_repo import get_user_by_email, create_user
from app.core.security import hash_password


async def main():
    email = "admin@example.com"
    password = "admin123"
    
    async for db in get_session():
        existing = await get_user_by_email(db, email)
        password_hash = hash_password(password)
        
        if existing:
            existing.role = "admin"
            existing.password_hash = password_hash
            await db.commit()
            print(f"✓ Admin user updated: {email}")
        else:
            user = await create_user(db, email, password_hash, "admin")
            await db.commit()
            print(f"✓ Admin user created: {email}")
        break


if __name__ == "__main__":
    asyncio.run(main())

