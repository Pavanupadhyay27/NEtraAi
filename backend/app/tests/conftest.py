import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock

from app.main import app
from app.core.database import get_db, Base
from app.core.security import get_current_user
from app.models import models

# Create a mock database session
@pytest.fixture(scope="session")
def db_session():
    mock_session = MagicMock()
    return mock_session

# Override the database dependency in FastAPI
@pytest.fixture(autouse=True)
def override_db(db_session):
    def _get_db_override():
        yield db_session
    app.dependency_overrides[get_db] = _get_db_override
    yield
    app.dependency_overrides.pop(get_db, None)

# Client fixture for requests
@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client

# Mock Current User to bypass JWT auth in CRUD endpoint tests
@pytest.fixture
def mock_admin_user():
    user = models.User(
        id=1,
        email="admin@netraid.ai",
        hashed_password="hashed_password",
        is_active=True,
        role_id=1
    )
    role = models.Role(id=1, name="Super Admin")
    user.role = role
    return user

@pytest.fixture
def authenticated_client(mock_admin_user):
    def _get_current_user_override():
        return mock_admin_user
    app.dependency_overrides[get_current_user] = _get_current_user_override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_current_user, None)
