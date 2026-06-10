from unittest.mock import patch
from app.models import models

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@patch("app.api.v1.auth.crud.get_user_by_email")
@patch("app.api.v1.auth.crud.verify_password")
@patch("app.api.v1.auth.crud.create_audit_log")
def test_login_success(mock_audit, mock_verify, mock_get_user, client):
    # Mock data
    mock_role = models.Role(id=1, name="Super Admin")
    mock_user = models.User(
        id=1,
        email="admin@netraid.ai",
        hashed_password="hashed_password",
        is_active=True,
        role_id=1,
        role=mock_role
    )
    
    mock_get_user.return_value = mock_user
    mock_verify.return_value = True
    
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@netraid.ai", "password": "Admin@NetraID2026"}
    )
    
    assert response.status_code == 200
    json_data = response.json()
    assert "access_token" in json_data
    assert "refresh_token" in json_data
    assert json_data["token_type"] == "bearer"

@patch("app.api.v1.auth.crud.get_user_by_email")
@patch("app.api.v1.auth.crud.verify_password")
@patch("app.api.v1.auth.crud.create_audit_log")
def test_login_incorrect_password(mock_audit, mock_verify, mock_get_user, client):
    mock_role = models.Role(id=1, name="Super Admin")
    mock_user = models.User(
        id=1,
        email="admin@netraid.ai",
        hashed_password="hashed_password",
        is_active=True,
        role_id=1,
        role=mock_role
    )
    
    mock_get_user.return_value = mock_user
    mock_verify.return_value = False
    
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@netraid.ai", "password": "wrong_password"}
    )
    
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"

def test_read_users_me(authenticated_client):
    response = authenticated_client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "admin@netraid.ai"


from app.core.security import create_access_token, get_current_user_sse
from fastapi import Request
from unittest.mock import MagicMock

def test_get_current_user_sse_query_param(db_session):
    # Mock user in DB
    mock_role = models.Role(id=1, name="Super Admin")
    mock_user = models.User(id=1, email="admin@netraid.ai", is_active=True, role=mock_role)
    
    with patch("app.core.security.crud.get_user_by_email", return_value=mock_user):
        token = create_access_token(subject="admin@netraid.ai", role="Super Admin")
        request = MagicMock(spec=Request)
        request.headers = {}
        
        user = get_current_user_sse(request=request, token=token, db=db_session)
        assert user.email == "admin@netraid.ai"

def test_live_stream_auth_failure(client):
    response = client.get("/api/v1/analytics/live-stream")
    assert response.status_code == 401

@patch("app.core.security.crud.get_user_by_email")
@patch("app.api.v1.analytics.event_bus.subscribe")
def test_live_stream_auth_success(mock_subscribe, mock_get_user, client):
    mock_role = models.Role(id=1, name="Super Admin")
    mock_user = models.User(id=1, email="admin@netraid.ai", is_active=True, role=mock_role)
    mock_get_user.return_value = mock_user
    
    # Pre-populate queue to prevent TestClient from hanging waiting for the first yield
    import asyncio
    q = asyncio.Queue()
    q.put_nowait({"type": "test"})
    mock_subscribe.return_value = q
    
    token = create_access_token(subject="admin@netraid.ai", role="Super Admin")
    
    with client.stream("GET", f"/api/v1/analytics/live-stream?token={token}") as response:
        assert response.status_code == 200
