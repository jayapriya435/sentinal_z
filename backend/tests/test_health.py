"""Tests for system health endpoint and LinuxONE readiness probe."""
from fastapi.testclient import TestClient
from app.main import app


def test_api_health_endpoint():
    """Assert GET /api/health returns 200 with active nodes, edges, and healthy status."""
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert data["app"] == "SENTINEL Z"
        assert data["active_nodes"] >= 15
        assert data["active_edges"] >= 15
        assert data["data_source_loaded"] is True
        assert data["linuxone_ready"] is True
        assert "timestamp" in data
