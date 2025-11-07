import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Drop
from app.repositories.user_repo import create_user
from app.repositories.drop_repo import create_drop
from app.core.security import hash_password, create_access_token


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    password_hash = hash_password("testpass123")
    user = await create_user(db_session, "test@example.com", password_hash)
    await db_session.commit()
    return user


@pytest.fixture
async def test_drop(db_session: AsyncSession) -> Drop:
    now = datetime.now(tz=timezone.utc)
    drop = await create_drop(
        db_session,
        title="Test Drop",
        description="Test",
        starts_at=now - timedelta(hours=1),
        claim_window_start=now - timedelta(minutes=30),
        claim_window_end=now + timedelta(hours=1),
        stock=10,
        is_active=True
    )
    await db_session.commit()
    return drop


@pytest.fixture
def auth_token(test_user: User) -> str:
    return create_access_token({"sub": str(test_user.id), "email": test_user.email, "role": test_user.role})


@pytest.mark.asyncio
async def test_join_endpoint_idempotent(client, test_user: User, test_drop: Drop, auth_token: str):
    # Test that multiple join requests are idempotent
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # First join
    response1 = await client.post(f"/drops/{test_drop.id}/join", headers=headers)
    assert response1.status_code == 204
    
    # Join again (should be idempotent)
    response2 = await client.post(f"/drops/{test_drop.id}/join", headers=headers)
    assert response2.status_code == 204
    
    # Verify user is in waitlist (only once)
    waitlist_response = await client.get(f"/drops", headers=headers)
    assert waitlist_response.status_code == 200
    drops = waitlist_response.json()
    test_drop_data = next((d for d in drops if d["id"] == test_drop.id), None)
    assert test_drop_data is not None
    assert test_drop_data["joined"] is True


@pytest.mark.asyncio
async def test_leave_endpoint_idempotent(client, test_user: User, test_drop: Drop, auth_token: str):
    # Test that multiple leave requests are idempotent
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # First join
    await client.post(f"/drops/{test_drop.id}/join", headers=headers)
    
    # Leave once
    response1 = await client.post(f"/drops/{test_drop.id}/leave", headers=headers)
    assert response1.status_code == 204
    
    # Leave again (should be idempotent, no error)
    response2 = await client.post(f"/drops/{test_drop.id}/leave", headers=headers)
    assert response2.status_code == 204
    
    # Verify user is not in waitlist
    waitlist_response = await client.get(f"/drops", headers=headers)
    assert waitlist_response.status_code == 200
    drops = waitlist_response.json()
    test_drop_data = next((d for d in drops if d["id"] == test_drop.id), None)
    assert test_drop_data is not None
    assert test_drop_data["joined"] is False


@pytest.mark.asyncio
async def test_claim_endpoint_idempotent(client, test_user: User, test_drop: Drop, auth_token: str):
    # Test that multiple claim requests return the same code (idempotent)
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Join waitlist first
    await client.post(f"/drops/{test_drop.id}/join", headers=headers)
    
    # First claim
    response1 = await client.post(f"/drops/{test_drop.id}/claim", headers=headers)
    assert response1.status_code == 200
    code1 = response1.json()["code"]
    assert code1 is not None
    
    # Claim again (should return same code)
    response2 = await client.post(f"/drops/{test_drop.id}/claim", headers=headers)
    assert response2.status_code == 200
    code2 = response2.json()["code"]
    
    # Should return the same code
    assert code1 == code2


@pytest.mark.asyncio
async def test_claim_endpoint_not_in_waitlist(client, test_user: User, test_drop: Drop, auth_token: str):
    # Test that claim fails if user is not in waitlist
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Try to claim without joining waitlist
    response = await client.post(f"/drops/{test_drop.id}/claim", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "not_in_waitlist"


@pytest.mark.asyncio
async def test_claim_endpoint_window_closed(client, test_user: User, db_session: AsyncSession, auth_token: str):
    # Test that claim fails if claim window is closed
    now = datetime.now(tz=timezone.utc)
    
    # Create drop with closed claim window
    drop = await create_drop(
        db_session,
        title="Closed Drop",
        description="Test",
        starts_at=now - timedelta(hours=2),
        claim_window_start=now - timedelta(hours=2),
        claim_window_end=now - timedelta(hours=1),
        stock=10,
        is_active=True
    )
    await db_session.commit()
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Join waitlist
    await client.post(f"/drops/{drop.id}/join", headers=headers)
    
    # Try to claim (should fail)
    response = await client.post(f"/drops/{drop.id}/claim", headers=headers)
    assert response.status_code == 409
    assert response.json()["detail"] == "claim_window_closed"

