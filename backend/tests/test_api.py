"""Tests for all REST API endpoints, validation schemas, and malformed input handling."""
from fastapi.testclient import TestClient
from app.main import app


def test_get_infrastructure_endpoint():
    """Assert GET /api/infrastructure returns complete topology matching schema."""
    with TestClient(app) as client:
        res = client.get("/api/infrastructure")
        assert res.status_code == 200
        data = res.json()

        assert data["node_count"] >= 15
        assert data["edge_count"] >= 15
        assert len(data["nodes"]) == data["node_count"]
        assert len(data["edges"]) == data["edge_count"]
        assert "node_types" in data
        assert "hospital" in data["node_types"]
        assert "substation" in data["node_types"]

        # Validate node structure
        first_node = data["nodes"][0]
        assert "id" in first_node
        assert "name" in first_node
        assert "criticality" in first_node
        assert 0.0 <= first_node["criticality"] <= 1.0
        assert "metadata" in first_node

        # Validate edge structure
        first_edge = data["edges"][0]
        assert "source" in first_edge
        assert "target" in first_edge
        assert "dependency_strength" in first_edge
        assert 0.0 <= first_edge["dependency_strength"] <= 1.0


def test_get_events_endpoint():
    """Assert GET /api/events returns formatted operational event logs."""
    with TestClient(app) as client:
        res = client.get("/api/events")
        assert res.status_code == 200
        data = res.json()

        assert "total_events" in data
        assert "unresolved_anomalies" in data
        assert "events" in data
        assert isinstance(data["events"], list)
        assert len(data["events"]) > 0

        event = data["events"][0]
        assert "id" in event
        assert "timestamp" in event
        assert "node_id" in event
        assert "severity" in event
        assert event["severity"] in ["info", "warning", "critical"]
        assert "message" in event


def test_get_risks_endpoint():
    """Assert GET /api/risks returns calculated risk metrics for all nodes."""
    with TestClient(app) as client:
        res = client.get("/api/risks")
        assert res.status_code == 200
        data = res.json()

        assert "overall_system_risk" in data
        assert 0.0 <= data["overall_system_risk"] <= 1.0
        assert "high_risk_node_count" in data
        assert "risks" in data
        assert len(data["risks"]) >= 15

        for node_risk in data["risks"]:
            assert 0.0 <= node_risk["criticality"] <= 1.0
            assert 0.0 <= node_risk["direct_risk"] <= 1.0
            assert 0.0 <= node_risk["cascade_risk"] <= 1.0
            assert 0.0 <= node_risk["composite_risk"] <= 1.0
            assert "reasoning" in node_risk
            assert len(node_risk["reasoning"]) > 5


def test_malformed_inputs_handling():
    """Assert API properly rejects malformed requests and invalid query/body parameters."""
    with TestClient(app) as client:
        # Invalid query parameters (limit bounds)
        res_zero = client.get("/api/events?limit=0")
        assert res_zero.status_code == 422

        res_negative = client.get("/api/events?limit=-5")
        assert res_negative.status_code == 422

        res_excessive = client.get("/api/events?limit=500")
        assert res_excessive.status_code == 422

        # Nonexistent node injection -> 404
        res_nonexistent = client.post("/api/telemetry/inject", json={
            "node_id": "ghost_substation_xyz",
            "scenario": "thermal_runaway",
            "intensity": 0.8
        })
        assert res_nonexistent.status_code == 404

        # Intensity out of bounds (> 1.0) -> 422
        res_bad_intensity = client.post("/api/telemetry/inject", json={
            "node_id": "sub_alpha",
            "intensity": 2.5
        })
        assert res_bad_intensity.status_code == 422

        # Missing required node_id -> 422
        res_missing = client.post("/api/telemetry/inject", json={
            "scenario": "thermal_runaway"
        })
        assert res_missing.status_code == 422


def test_fault_injection_and_cascade_impact():
    """Assert fault injection on Substation Alpha raises direct risk and triggers downstream cascade."""
    with TestClient(app) as client:
        # Inject severe thermal runaway on sub_alpha
        res_inject = client.post("/api/telemetry/inject", json={
            "node_id": "sub_alpha",
            "scenario": "thermal_runaway",
            "intensity": 0.95,
            "duration_seconds": 60
        })
        assert res_inject.status_code == 200
        assert res_inject.json()["status"] == "injected"

        # Check risks update
        res_risks = client.get("/api/risks")
        assert res_risks.status_code == 200
        risk_map = {r["node_id"]: r for r in res_risks.json()["risks"]}

        # sub_alpha direct risk should be high
        assert risk_map["sub_alpha"]["direct_risk"] >= 0.60
        assert risk_map["sub_alpha"]["status"] in ["warning", "critical"]

        # Downstream Transformer T101 should reflect cascade risk
        assert risk_map["trans_t1"]["cascade_risk"] > 0.30

        # Reset simulation
        res_reset = client.post("/api/telemetry/reset")
        assert res_reset.status_code == 200
        assert res_reset.json()["status"] == "success"


def test_get_recommendations_endpoint():
    """Assert GET /api/recommendations returns explainable mitigations."""
    with TestClient(app) as client:
        res = client.get("/api/recommendations")
        assert res.status_code == 200
        data = res.json()

        assert "recommendations" in data
        assert len(data["recommendations"]) > 0
        rec = data["recommendations"][0]
        assert "priority" in rec
        assert "action_type" in rec
        assert "title" in rec
        assert "reasoning" in rec
