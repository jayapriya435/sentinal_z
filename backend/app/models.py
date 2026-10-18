"""Pydantic data models and API response schemas for SENTINEL Z."""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime


# Infrastructure Models
class NodeModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Unique alphanumeric identifier for the infrastructure node")
    name: str = Field(..., description="Human-readable display name")
    type: Literal[
        "substation",
        "transformer",
        "hospital",
        "traffic_system",
        "communication_hub",
        "emergency_facility"
    ] = Field(..., description="Sector category of the node")
    criticality: float = Field(..., ge=0.0, le=1.0, description="Priority weight from 0.0 to 1.0")
    status: Literal["nominal", "warning", "critical", "offline"] = Field(
        default="nominal",
        description="Current operational status"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Sector-specific operational metadata")


class EdgeModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    source: str = Field(..., description="Source node ID supplying power, telecom, or service")
    target: str = Field(..., description="Target node ID receiving or depending on the supply")
    dependency_strength: float = Field(..., ge=0.0, le=1.0, description="Coupling strength from 0.0 to 1.0")
    dependency_type: Literal["power", "telecom", "operational", "water"] = Field(
        ...,
        description="Type of inter-facility coupling"
    )
    alternative_path_exists: bool = Field(
        default=False,
        description="Flag indicating whether known secondary/backup redundant path exists"
    )


class InfrastructureData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    version: str = "1.0.0"
    name: str
    generated_for: str = "SENTINEL Z - CrisisGraph Engine"
    nodes: List[NodeModel]
    edges: List[EdgeModel]


class InfrastructureResponse(BaseModel):
    version: str
    name: str
    node_count: int
    edge_count: int
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    node_types: Dict[str, int]


# Health Response Model
class HealthResponse(BaseModel):
    status: str = "healthy"
    app: str = "SENTINEL Z"
    version: str = "1.0.0"
    timestamp: str
    active_nodes: int
    active_edges: int
    data_source_loaded: bool
    linuxone_ready: bool = True


# Sensor & Telemetry Models
class SensorReading(BaseModel):
    node_id: str
    node_name: str
    voltage_kv: float
    temperature_c: float
    load_percentage: float
    frequency_hz: float
    anomaly_score: float = Field(..., ge=0.0, le=1.0)
    is_anomaly: bool
    timestamp: str


# Events & Logs Models
class EventModel(BaseModel):
    id: str
    timestamp: str
    node_id: str
    node_name: str
    severity: Literal["info", "warning", "critical"]
    event_type: str
    message: str
    anomaly_score: float = Field(default=0.0, ge=0.0, le=1.0)
    cascade_depth: int = 0


class EventsResponse(BaseModel):
    total_events: int
    unresolved_anomalies: int
    events: List[EventModel]


# Risk Models
class NodeRisk(BaseModel):
    node_id: str
    node_name: str
    node_type: str
    criticality: float = Field(..., ge=0.0, le=1.0)
    direct_risk: float = Field(..., ge=0.0, le=1.0, description="Intrinsic risk from local sensor anomaly")
    cascade_risk: float = Field(..., ge=0.0, le=1.0, description="Propagated risk from upstream dependencies")
    composite_risk: float = Field(..., ge=0.0, le=1.0, description="Overall transparent weighted risk score")
    status: Literal["nominal", "warning", "critical", "offline"]
    impacted_by: List[str] = Field(default_factory=list, description="IDs of upstream nodes transmitting risk")
    reasoning: str = Field(..., description="Explainable deterministic breakdown of risk factors")


class RisksResponse(BaseModel):
    evaluated_at: str
    overall_system_risk: float = Field(..., ge=0.0, le=1.0)
    high_risk_node_count: int
    nodes_evaluated: int
    risks: List[NodeRisk]


# Counterfactual Scenario Comparison Models
class ScenarioComparisonRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    failed_node_id: str = Field(..., description="ID of the component experiencing failure or stress")
    failure_severity: float = Field(
        default=0.90,
        ge=0.1,
        le=1.0,
        description="Severity of the initial anomaly/failure (0.1 to 1.0)"
    )
    intervention_type: Literal[
        "no_intervention",
        "load_rerouting",
        "component_isolation",
        "redundant_failover"
    ] = Field(..., description="Counterfactual intervention to simulate")
    target_node_id: Optional[str] = Field(
        default=None,
        description="Optional target node for the intervention; defaults to failed_node_id"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional scenario-specific parameters"
    )


class ComponentRiskComparison(BaseModel):
    model_config = ConfigDict(extra="ignore")

    node_id: str
    node_name: str
    node_type: str
    criticality: float = Field(..., ge=0.0, le=1.0)
    baseline_direct_risk: float = Field(..., ge=0.0, le=1.0)
    baseline_cascade_risk: float = Field(..., ge=0.0, le=1.0)
    baseline_composite_risk: float = Field(..., ge=0.0, le=1.0)
    baseline_status: str
    intervention_direct_risk: float = Field(..., ge=0.0, le=1.0)
    intervention_cascade_risk: float = Field(..., ge=0.0, le=1.0)
    intervention_composite_risk: float = Field(..., ge=0.0, le=1.0)
    intervention_status: str
    risk_delta: float = Field(..., description="baseline_composite - intervention_composite (positive = improved)")
    risk_improved: bool
    is_newly_affected: bool = Field(..., description="True if nominal in baseline but compromised in intervention")
    reasoning: str


class CascadePathDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")

    node_id: str
    node_name: str
    cascade_impact: float = Field(..., ge=0.0, le=1.0)
    hop_distance: int
    causal_path: List[str]
    reasoning: str


class ScenarioComparisonResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    scenario_name: str
    intervention_type: str
    failed_node_id: str
    failed_node_name: str
    is_feasible: bool
    feasibility_reason: Optional[str] = None
    assumptions: List[str]

    baseline_overall_risk: float = Field(..., ge=0.0, le=1.0)
    intervention_overall_risk: float = Field(..., ge=0.0, le=1.0)
    overall_risk_delta: float
    baseline_critical_facilities_affected: int
    intervention_critical_facilities_affected: int

    baseline_affected_components: List[CascadePathDetail]
    intervention_affected_components: List[CascadePathDetail]
    component_comparisons: List[ComponentRiskComparison]
    newly_affected_components: List[str]
    improved_components: List[str]

    recommendation: str
    explanation: str
