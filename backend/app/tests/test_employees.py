from unittest.mock import patch, MagicMock
from app.models import models

@patch("app.api.v1.employees.crud.get_employees")
def test_read_employees(mock_get, authenticated_client):
    mock_employee = models.Employee(
        id=1,
        employee_id="EMP101",
        name="John Doe",
        email="john@netraid.ai",
        phone="9876543210",
        designation="Software Engineer",
        joining_date="2026-06-10",
        status="Active"
    )
    mock_get.return_value = [mock_employee]
    
    response = authenticated_client.get("/api/v1/employees/")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["employee_id"] == "EMP101"
    assert response.json()[0]["name"] == "John Doe"

@patch("app.api.v1.employees.crud.get_employee_by_id")
def test_read_employee_not_found(mock_get_id, authenticated_client):
    mock_get_id.return_value = None
    response = authenticated_client.get("/api/v1/employees/99")
    assert response.status_code == 404
    assert response.json()["detail"] == "Employee not found"

@patch("app.api.v1.employees.crud.get_employee_by_uuid")
@patch("app.api.v1.employees.crud.get_employee_by_email")
@patch("app.api.v1.employees.crud.get_employee_by_name")
@patch("app.api.v1.employees.crud.get_employee_by_phone")
@patch("app.api.v1.employees.crud.create_employee")
@patch("app.api.v1.employees.crud.create_audit_log")
def test_create_employee(mock_audit, mock_create, mock_get_phone, mock_get_name, mock_get_email, mock_get_uuid, authenticated_client):
    mock_get_uuid.return_value = None
    mock_get_email.return_value = None
    mock_get_name.return_value = None
    mock_get_phone.return_value = None
    
    mock_employee = models.Employee(
        id=2,
        employee_id="EMP102",
        name="Jane Smith",
        email="jane@netraid.ai",
        joining_date="2026-06-10",
        status="Active"
    )
    mock_create.return_value = mock_employee
    
    payload = {
        "employee_id": "EMP102",
        "name": "Jane Smith",
        "email": "jane@netraid.ai",
        "phone": "9876543211",
        "designation": "HR Manager",
        "joining_date": "2026-06-10",
        "status": "Active",
        "create_user_login": False
    }
    
    response = authenticated_client.post("/api/v1/employees/", json=payload)
    assert response.status_code == 201
    assert response.json()["employee_id"] == "EMP102"
    assert response.json()["name"] == "Jane Smith"
