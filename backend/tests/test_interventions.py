"""Comprehensive test suite for Counterfactual Intervention Simulation engine."""
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_graph
from app.models import ScenarioComparisonRequest
from app.interventions import InterventionEngine


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_valid_scenario_comparison_no_intervention(client):
    """Assert valid baseline comparison with no_intervention produces matching risk scores."""
    payload = {
        "failed_node_id": "sub_alpha",
        "failure_severity": 0.90,
        "intervention_type": "no_intervention"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["failed_node_id"] == "sub_alpha"
    assert data["failed_node_name"] == "Alpha Transmission Substation (500kV)"
    assert data["is_feasible"] is True
    assert data["overall_risk_delta"] == 0.0
    assert data["baseline_overall_risk"] == data["intervention_overall_risk"]
    assert len(data["component_comparisons"]) == 16
    assert len(data["newly_affected_components"]) == 0
    assert len(data["improved_components"]) == 0


def test_unknown_component_raises_400(client):
    """Assert requesting a scenario with an unknown component ID returns 400 Bad Request."""
    payload = {
        "failed_node_id": "ghost_substation_999",
        "failure_severity": 0.85,
        "intervention_type": "no_intervention"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 400
    assert "does not exist in the infrastructure topology" in res.json()["detail"]


def test_unsupported_intervention_rejected(client):
    """Assert requesting an invalid intervention type triggers schema validation error (422)."""
    payload = {
        "failed_node_id": "sub_alpha",
        "failure_severity": 0.85,
        "intervention_type": "quantum_field_shield"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 422


def test_no_available_alternate_path_infeasible(client):
    """Assert load rerouting on a component lacking alternate paths is marked infeasible."""
    # traffic_port_tunnel has only 1 incoming power feed with alternative_path_exists: false
    payload = {
        "failed_node_id": "trans_t1",
        "target_node_id": "traffic_port_tunnel",
        "failure_severity": 0.85,
        "intervention_type": "load_rerouting"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["is_feasible"] is False
    assert data["feasibility_reason"] is not None
    assert "alternative transmission path" in data["feasibility_reason"]


def test_isolation_affecting_dependent_services(client):
    """Assert isolating an upstream component cuts service to downstream dependents lacking backup."""
    # trans_t1 supplies traffic_port_tunnel (no backup generator). Isolating trans_t1 causes collateral outage!
    payload = {
        "failed_node_id": "sub_alpha",
        "target_node_id": "trans_t1",
        "failure_severity": 0.90,
        "intervention_type": "component_isolation"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["is_feasible"] is True
    # traffic_port_tunnel should be newly affected collateral damage
    newly_affected = data["newly_affected_components"]
    assert any("Port Expressway" in name for name in newly_affected)

    # Check the component comparison entry for traffic_port_tunnel
    tunnel_comp = next(c for c in data["component_comparisons"] if c["node_id"] == "traffic_port_tunnel")
    assert tunnel_comp["is_newly_affected"] is True


def test_intervention_improves_risk(client):
    """Assert redundant failover on hospital reduces risk and produces positive delta."""
    payload = {
        "failed_node_id": "sub_alpha",
        "target_node_id": "hosp_metro",
        "failure_severity": 0.90,
        "intervention_type": "redundant_failover"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["is_feasible"] is True
    assert data["overall_risk_delta"] > 0
    assert any("Metro General Hospital" in name for name in data["improved_components"])

    hosp_comp = next(c for c in data["component_comparisons"] if c["node_id"] == "hosp_metro")
    assert hosp_comp["risk_improved"] is True
    assert hosp_comp["risk_delta"] > 0
    assert hosp_comp["intervention_composite_risk"] < hosp_comp["baseline_composite_risk"]


def test_intervention_fails_to_improve_risk(client):
    """Assert an intervention that produces no net reduction reports delta <= 0."""
    payload = {
        "failed_node_id": "sub_alpha",
        "failure_severity": 0.90,
        "intervention_type": "no_intervention"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["overall_risk_delta"] <= 0.0


def test_independent_baseline_and_intervention_graph_states(client):
    """Assert evaluating interventions leaves the live CrisisGraph topology completely unmutated."""
    graph = get_graph()
    initial_node_count = graph.node_count
    initial_edge_count = graph.edge_count

    # Execute component_isolation which severs edges in the clone
    payload = {
        "failed_node_id": "sub_alpha",
        "target_node_id": "trans_t1",
        "failure_severity": 0.90,
        "intervention_type": "component_isolation"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 200

    # Verify live graph was NOT modified
    assert graph.node_count == initial_node_count
    assert graph.edge_count == initial_edge_count
    assert graph.graph.has_edge("trans_t1", "traffic_port_tunnel") is True


def test_risk_values_within_valid_bounds(client):
    """Assert all risk metrics in the comparison response lie within [0.0, 1.0]."""
    payload = {
        "failed_node_id": "sub_alpha",
        "target_node_id": "hosp_metro",
        "failure_severity": 0.95,
        "intervention_type": "redundant_failover"
    }
    res = client.post("/api/simulate/interventions", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert 0.0 <= data["baseline_overall_risk"] <= 1.0
    assert 0.0 <= data["intervention_overall_risk"] <= 1.0

    for comp in data["component_comparisons"]:
        assert 0.0 <= comp["criticality"] <= 1.0
        assert 0.0 <= comp["baseline_direct_risk"] <= 1.0
        assert 0.0 <= comp["baseline_cascade_risk"] <= 1.0
        assert 0.0 <= comp["baseline_composite_risk"] <= 1.0
        assert 0.0 <= comp["intervention_direct_risk"] <= 1.0
        assert 0.0 <= comp["intervention_cascade_risk"] <= 1.0
        assert 0.0 <= comp["intervention_composite_risk"] <= 1.0


def test_repeatable_scenario_calculations(client):
    """Assert identical inputs produce identical deterministic scenario results."""
    payload = {
        "failed_node_id": "sub_alpha",
        "target_node_id": "hosp_metro",
        "failure_severity": 0.85,
        "intervention_type": "redundant_failover"
    }
    res1 = client.post("/api/simulate/interventions", json=payload).json()
    res2 = client.post("/api/simulate/interventions", json=payload).json()

    assert res1["baseline_overall_risk"] == res2["baseline_overall_risk"]
    assert res1["intervention_overall_risk"] == res2["intervention_overall_risk"]
    assert res1["overall_risk_delta"] == res2["overall_risk_delta"]
    assert len(res1["component_comparisons"]) == len(res2["component_comparisons"])
    assert res1["newly_affected_components"] == res2["newly_affected_components"]
    assert res1["improved_components"] == res2["improved_components"]
