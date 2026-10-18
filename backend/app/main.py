"""FastAPI application entrypoint for SENTINEL Z."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from collections import Counter

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.models import (
    HealthResponse,
    InfrastructureResponse,
    EventsResponse,
    RisksResponse,
    InfrastructureData,
    ScenarioComparisonRequest,
    ScenarioComparisonResponse
)
from app.crisis_graph import CrisisGraph
from app.simulator_engine import SimulatorEngine
from app.recommendations import RecommendationEngine
from app.interventions import InterventionEngine

# Global singleton state
crisis_graph: Optional[CrisisGraph] = None
simulator_engine: Optional[SimulatorEngine] = None
recommendation_engine: Optional[RecommendationEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes graph, ML anomaly detector, and telemetry simulator on startup."""
    global crisis_graph, simulator_engine, recommendation_engine

    # Load Infrastructure Graph
    crisis_graph = CrisisGraph(settings.data_file_path)

    # Initialize Engine & Run First Step
    simulator_engine = SimulatorEngine(crisis_graph)
    simulator_engine.step()

    # Initialize Recommendations
    recommendation_engine = RecommendationEngine(crisis_graph)

    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Real-Time AI for Predicting Cascading Infrastructure Failures - CrisisGraph Engine",
    lifespan=lifespan
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_engine() -> SimulatorEngine:
    if simulator_engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Simulator engine is not initialized yet."
        )
    return simulator_engine


def get_graph() -> CrisisGraph:
    if crisis_graph is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CrisisGraph is not initialized yet."
        )
    return crisis_graph


@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def get_health() -> HealthResponse:
    """Returns the operational health and readiness of the SENTINEL Z backend."""
    graph = get_graph()
    return HealthResponse(
        status="healthy",
        app=settings.app_name,
        version=settings.version,
        timestamp=datetime.now(timezone.utc).isoformat(),
        active_nodes=graph.node_count,
        active_edges=graph.edge_count,
        data_source_loaded=graph.node_count > 0,
        linuxone_ready=True
    )


@app.get("/api/infrastructure", response_model=InfrastructureResponse, tags=["Infrastructure"])
async def get_infrastructure() -> InfrastructureResponse:
    """Returns the full infrastructure dependency network with all nodes, metadata, and edges."""
    graph = get_graph()
    nodes = graph.get_all_nodes()
    edges = graph.get_all_edges()

    # Aggregate node type counts
    type_counts = Counter(node.type for node in nodes)

    return InfrastructureResponse(
        version=graph.metadata.get("version", "1.0.0"),
        name=graph.metadata.get("name", "Critical Infrastructure Network"),
        node_count=len(nodes),
        edge_count=len(edges),
        nodes=nodes,
        edges=edges,
        node_types=dict(type_counts)
    )


@app.get("/api/events", response_model=EventsResponse, tags=["Telemetry & Events"])
async def get_events(
    limit: int = Query(default=50, ge=1, le=100, description="Max number of events to return")
) -> EventsResponse:
    """Returns recent anomaly detections, threshold breaches, and cascade propagation alerts."""
    engine = get_engine()
    response = engine.get_events_response()
    if limit < len(response.events):
        response.events = response.events[:limit]
    return response


@app.get("/api/risks", response_model=RisksResponse, tags=["Risk Analysis"])
async def get_risks() -> RisksResponse:
    """Calculates and returns transparent direct and cascade risk scores across all infrastructure nodes."""
    engine = get_engine()
    return engine.get_risks_response()


class FaultInjectionRequest(BaseModel):
    node_id: str = Field(..., description="Target node ID to inject stress/fault")
    scenario: str = Field(
        default="thermal_runaway",
        description="Type of fault: thermal_runaway, overload_surge, voltage_sag, trip"
    )
    intensity: float = Field(default=0.85, ge=0.1, le=1.0, description="Fault severity from 0.1 to 1.0")
    duration_seconds: int = Field(default=60, ge=5, le=600, description="Active duration of the fault")


@app.post("/api/telemetry/inject", tags=["Simulation Control"])
async def inject_fault(request: FaultInjectionRequest) -> Dict[str, Any]:
    """Injects a controlled hardware fault or sensor anomaly to simulate cascading failure conditions."""
    engine = get_engine()
    graph = get_graph()

    if request.node_id not in graph.nodes_dict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{request.node_id}' does not exist in the infrastructure network."
        )

    engine.simulator.inject_fault(
        node_id=request.node_id,
        scenario=request.scenario,
        intensity=request.intensity,
        duration_seconds=request.duration_seconds
    )
    # Re-evaluate engine step immediately
    engine.step()

    return {
        "status": "injected",
        "node_id": request.node_id,
        "scenario": request.scenario,
        "intensity": request.intensity,
        "message": f"Injected {request.scenario} on {request.node_id}. Re-evaluated cascade."
    }


@app.post("/api/telemetry/reset", tags=["Simulation Control"])
async def reset_simulation() -> Dict[str, str]:
    """Clears all active fault injections and resets nodes to nominal states."""
    engine = get_engine()
    engine.simulator.clear_faults()
    engine.step()
    return {"status": "success", "message": "All faults cleared. System reset to nominal baseline."}


@app.get("/api/recommendations", tags=["Decision Support"])
async def get_recommendations() -> Dict[str, Any]:
    """Returns ranked, explainable preventive mitigations for active risks."""
    engine = get_engine()
    if recommendation_engine is None:
        raise HTTPException(status_code=500, detail="Recommendation engine uninitialized")

    risks = engine.get_risks_response().risks
    recs = recommendation_engine.generate_recommendations(risks)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_recommendations": len(recs),
        "recommendations": recs
    }


@app.post(
    "/api/simulate/interventions",
    response_model=ScenarioComparisonResponse,
    tags=["Counterfactual Simulation"]
)
@app.post(
    "/api/interventions/compare",
    response_model=ScenarioComparisonResponse,
    tags=["Counterfactual Simulation"]
)
async def compare_interventions(request: ScenarioComparisonRequest) -> ScenarioComparisonResponse:
    """
    Evaluates a counterfactual mitigation intervention against baseline unmitigated failure cascade.
    Runs on isolated graph clones without altering the live production graph state.
    """
    graph = get_graph()
    engine = InterventionEngine(graph)
    try:
        return engine.simulate_scenario(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

