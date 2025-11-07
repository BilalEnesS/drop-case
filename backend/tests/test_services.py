import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Drop
from app.services.drop_service import DropService
from app.services.priority_service import PriorityService
from app.repositories.user_repo import create_user
from app.repositories.drop_repo import create_drop
from app.core.security import hash_password


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    # Create a test user
    password_hash = hash_password("testpass123")
    user = await create_user(db_session, "test@example.com", password_hash)
    await db_session.commit()
    return user


@pytest.fixture
async def test_drop(db_session: AsyncSession) -> Drop:
    # Create a test drop with claim window in the future
    now = datetime.now(tz=timezone.utc)
    drop = await create_drop(
        db_session,
        title="Test Drop",
        description="Test Description",
        starts_at=now - timedelta(hours=1),
        claim_window_start=now - timedelta(minutes=30),
        claim_window_end=now + timedelta(hours=1),
        stock=10,
        is_active=True
    )
    await db_session.commit()
    return drop


@pytest.mark.asyncio
async def test_drop_service_join_waitlist_idempotent(
    db_session: AsyncSession,
    test_user: User,
    test_drop: Drop
):
    # Test that joining waitlist multiple times is idempotent
    service = DropService(db_session)
    
    # First join
    await service.join_waitlist(user_id=test_user.id, drop_id=test_drop.id)
    
    # Count waitlist entries
    from sqlalchemy import select, func
    from app.models import Waitlist
    count1 = await db_session.execute(
        select(func.count(Waitlist.id)).where(
            Waitlist.user_id == test_user.id,
            Waitlist.drop_id == test_drop.id
        )
    )
    waitlist_count_1 = count1.scalar_one()
    
    # Join again (should be idempotent)
    await service.join_waitlist(user_id=test_user.id, drop_id=test_drop.id)
    
    # Count again
    count2 = await db_session.execute(
        select(func.count(Waitlist.id)).where(
            Waitlist.user_id == test_user.id,
            Waitlist.drop_id == test_drop.id
        )
    )
    waitlist_count_2 = count2.scalar_one()
    
    # Should still be 1 (idempotent)
    assert waitlist_count_1 == 1
    assert waitlist_count_2 == 1


@pytest.mark.asyncio
async def test_drop_service_leave_waitlist_idempotent(
    db_session: AsyncSession,
    test_user: User,
    test_drop: Drop
):
    # Test that leaving waitlist multiple times is idempotent
    service = DropService(db_session)
    
    # First join
    await service.join_waitlist(user_id=test_user.id, drop_id=test_drop.id)
    await db_session.commit()
    
    # Leave once
    await service.leave_waitlist(user_id=test_user.id, drop_id=test_drop.id)
    await db_session.commit()
    
    # Count waitlist entries (should be 0)
    from sqlalchemy import select, func
    from app.models import Waitlist
    count1 = await db_session.execute(
        select(func.count(Waitlist.id)).where(
            Waitlist.user_id == test_user.id,
            Waitlist.drop_id == test_drop.id
        )
    )
    waitlist_count_1 = count1.scalar_one()
    assert waitlist_count_1 == 0
    
    # Leave again (should be idempotent, no error)
    await service.leave_waitlist(user_id=test_user.id, drop_id=test_drop.id)
    await db_session.commit()
    
    # Count again (should still be 0)
    count2 = await db_session.execute(
        select(func.count(Waitlist.id)).where(
            Waitlist.user_id == test_user.id,
            Waitlist.drop_id == test_drop.id
        )
    )
    waitlist_count_2 = count2.scalar_one()
    assert waitlist_count_2 == 0


@pytest.mark.asyncio
async def test_drop_service_claim_idempotent(
    db_session: AsyncSession,
    test_user: User,
    test_drop: Drop
):
    # Test that claiming multiple times returns the same code (idempotent)
    service = DropService(db_session)
    
    # Join waitlist first
    await service.join_waitlist(user_id=test_user.id, drop_id=test_drop.id)
    
    # First claim
    code1 = await service.claim(user_id=test_user.id, drop_id=test_drop.id)
    
    # Claim again (should return same code - idempotent)
    code2 = await service.claim(user_id=test_user.id, drop_id=test_drop.id)
    
    # Should return the same code
    assert code1 == code2
    
    # Verify only one claim record exists
    from sqlalchemy import select, func
    from app.models import Claim
    count = await db_session.execute(
        select(func.count(Claim.id)).where(
            Claim.user_id == test_user.id,
            Claim.drop_id == test_drop.id
        )
    )
    claim_count = count.scalar_one()
    assert claim_count == 1


@pytest.mark.asyncio
async def test_drop_service_claim_window_validation(
    db_session: AsyncSession,
    test_user: User
):
    # Test that claim fails if window is closed
    now = datetime.now(tz=timezone.utc)
    
    # Create drop with closed claim window
    drop = await create_drop(
        db_session,
        title="Closed Drop",
        description="Test",
        starts_at=now - timedelta(hours=2),
        claim_window_start=now - timedelta(hours=2),
        claim_window_end=now - timedelta(hours=1),  # Already closed
        stock=10,
        is_active=True
    )
    await db_session.commit()
    
    service = DropService(db_session)
    
    # Join waitlist
    await service.join_waitlist(user_id=test_user.id, drop_id=drop.id)
    await db_session.commit()
    
    # Try to claim (should fail)
    with pytest.raises(ValueError, match="claim_window_closed"):
        await service.claim(user_id=test_user.id, drop_id=drop.id)

