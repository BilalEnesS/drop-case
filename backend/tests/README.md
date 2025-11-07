# Backend Tests

## Running Tests

```bash
# Install dependencies
pip install -r requirements.txt

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_services.py

# Run specific test
pytest tests/test_services.py::test_drop_service_join_waitlist_idempotent
```

## Test Structure

- `test_services.py`: Unit tests for service layer (DropService)
  - Tests idempotency of join/leave/claim operations
  - Tests claim window validation
  
- `test_api_idempotency.py`: Integration tests for API endpoints
  - Tests idempotency of join/leave/claim endpoints
  - Tests error handling and edge cases

## Test Database

Tests use an in-memory SQLite database that is created and destroyed for each test.
This ensures test isolation and fast execution.

