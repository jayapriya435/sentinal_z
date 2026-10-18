"""Tests for infrastructure data loading, validation, graph integrity, and cascade reachability."""
import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from app.models import InfrastructureData, NodeModel, EdgeModel
from app.crisis_graph import CrisisGraph
from app.config import settings


def test_infrastructure_file_exists():
    """Assert data/infrastructure.json exists and contains valid JSON."""
    assert settings.data_file_path.exists(), f"File does not exist: {settings.data_file_path}"
    with open(settings.data_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, dict)
    assert "nodes" in data
    assert "edges" in data


def test_infrastructure_node_count_and_types():
    """Assert network contains at least 15 nodes and covers all required sectors."""
    cg = CrisisGraph(settings.data_file_path)
    assert cg.node_count >= 15, f"Expected at least 15 nodes, got {cg.node_count}"

    required_types = {
        "substation",
        "transformer",
        "hospital",
        "traffic_system",
        "communication_hub",
        "emergency_facility"
    }
    present_types = {node.type for node in cg.get_all_nodes()}
    missing_types = required_types - present_types
    assert not missing_types, f"Missing required infrastructure sectors: {missing_types}"


def test_unique_node_ids():
    """Assert all node IDs are unique strings."""
    with open(settings.data_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    node_ids = [node["id"] for node in data["nodes"]]
    assert len(node_ids) == len(set(node_ids)), "Duplicate node IDs detected in dataset"


def test_valid_dependency_edge_references():
    """Assert every edge references existing source and target nodes."""
    cg = CrisisGraph(settings.data_file_path)
    node_ids = set(cg.nodes_dict.keys())

    for edge in cg.get_all_edges():
        assert edge.source in node_ids, f"Edge source '{edge.source}' not found in node IDs"
        assert edge.target in node_ids, f"Edge target '{edge.target}' not found in node IDs"
        assert edge.source != edge.target, f"Self-referencing loop detected on edge '{edge.source}'"


def test_valid_criticality_and_strength_ranges():
    """Assert criticality and dependency_strength are strictly within [0.0, 1.0]."""
    cg = CrisisGraph(settings.data_file_path)

    for node in cg.get_all_nodes():
        assert 0.0 <= node.criticality <= 1.0, (
            f"Node {node.id} criticality {node.criticality} out of bounds [0.0, 1.0]"
        )

    for edge in cg.get_all_edges():
        assert 0.0 <= edge.dependency_strength <= 1.0, (
            f"Edge ({edge.source} -> {edge.target}) strength {edge.dependency_strength} out of bounds [0.0, 1.0]"
        )


def test_pydantic_schema_rejection_on_invalid_bounds():
    """Assert Pydantic rejects invalid criticality (> 1.0) and negative dependency strength."""
    with pytest.raises(ValidationError):
        NodeModel(
            id="bad_node",
            name="Bad Node",
            type="substation",
            criticality=1.5  # Invalid, must be <= 1.0
        )

    with pytest.raises(ValidationError):
        EdgeModel(
            source="a",
            target="b",
            dependency_strength=-0.2,  # Invalid, must be >= 0.0
            dependency_type="power"
        )


def test_duplicate_node_id_raises_value_error():
    """Assert CrisisGraph raises ValueError when attempting to load duplicate node IDs."""
    bad_data = {
        "version": "1.0.0",
        "name": "Bad Network",
        "nodes": [
            {"id": "n1", "name": "Node 1", "type": "substation", "criticality": 0.5},
            {"id": "n1", "name": "Duplicate Node 1", "type": "hospital", "criticality": 0.9}
        ],
        "edges": []
    }
    cg = CrisisGraph()
    with pytest.raises(ValueError, match="Duplicate node ID"):
        cg.load(bad_data)


def test_invalid_edge_reference_raises_value_error():
    """Assert CrisisGraph raises ValueError when an edge references a nonexistent node."""
    bad_data = {
        "version": "1.0.0",
        "name": "Bad Network",
        "nodes": [
            {"id": "n1", "name": "Node 1", "type": "substation", "criticality": 0.5}
        ],
        "edges": [
            {"source": "n1", "target": "non_existent_node", "dependency_strength": 0.8, "dependency_type": "power"}
        ]
    }
    cg = CrisisGraph()
    with pytest.raises(ValueError, match="Edge target 'non_existent_node' does not exist"):
        cg.load(bad_data)


def test_upstream_failure_affects_multiple_downstream_components():
    """Assert upstream substation failure cascades to multiple multi-tier downstream nodes."""
    cg = CrisisGraph(settings.data_file_path)

    # Downstream dependents of sub_alpha
    downstream = cg.get_downstream_nodes("sub_alpha")
    assert len(downstream) >= 4, f"Expected sub_alpha to reach at least 4 downstream nodes, got {len(downstream)}"

    # Check key critical infrastructure is in downstream reach
    assert "trans_t1" in downstream
    assert "trans_t2" in downstream
    assert "hosp_metro" in downstream
    assert "hosp_stjude" in downstream

    # Simulate cascade from sub_alpha at 90% severity
    cascade = cg.simulate_cascade({"sub_alpha": 0.90})
    assert "trans_t1" in cascade
    assert "trans_t2" in cascade
    # trans_t2 has no alternative path, so cascade impact is unattenuated (> 0.50)
    assert cascade["trans_t2"]["cascade_impact"] > 0.50
    # trans_t1 has an alternative redundant feed, so impact is mitigated (> 0.35)
    assert cascade["trans_t1"]["cascade_impact"] > 0.35
    assert "hosp_metro" in cascade
    assert "reasoning" in cascade["hosp_metro"]
