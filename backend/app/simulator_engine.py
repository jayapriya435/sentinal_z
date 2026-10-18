"""Engine orchestrating telemetry simulation, ML anomaly detection, and cascade risk calculation."""
from typing import Dict, List, Optional
from datetime import datetime, timezone
import uuid

from app.models import (
    SensorReading,
    EventModel,
    EventsResponse,
    NodeRisk,
    RisksResponse,
    NodeModel
)
from app.crisis_graph import CrisisGraph
from app.anomaly_model import AnomalyDetector
from app.simulator import SyntheticTelemetrySimulator


class SimulatorEngine:
    """Coordinates telemetry generation, ML anomaly detection, and CrisisGraph cascade risk evaluation."""

    def __init__(self, crisis_graph: CrisisGraph):
        self.graph = crisis_graph
        self.detector = AnomalyDetector()
        self.simulator = SyntheticTelemetrySimulator()
        self.recent_events: List[EventModel] = []
        self.max_events_history = 100
        self.latest_readings: Dict[str, SensorReading] = {}
        self.latest_risks: Dict[str, NodeRisk] = {}

    def step(self) -> None:
        """Executes one simulation step: generates telemetry, detects anomalies, evaluates cascade."""
        now_iso = datetime.now(timezone.utc).isoformat()
        failing_roots: Dict[str, float] = {}

        # 1. Telemetry generation and ML anomaly detection
        for node in self.graph.get_all_nodes():
            raw_metrics = self.simulator.generate_reading(node)
            score, is_anomaly, explanation = self.detector.score_telemetry(
                voltage_kv=raw_metrics["voltage_kv"],
                temperature_c=raw_metrics["temperature_c"],
                load_percentage=raw_metrics["load_percentage"],
                frequency_hz=raw_metrics["frequency_hz"]
            )

            reading = SensorReading(
                node_id=node.id,
                node_name=node.name,
                voltage_kv=raw_metrics["voltage_kv"],
                temperature_c=raw_metrics["temperature_c"],
                load_percentage=raw_metrics["load_percentage"],
                frequency_hz=raw_metrics["frequency_hz"],
                anomaly_score=score,
                is_anomaly=is_anomaly,
                timestamp=now_iso
            )
            self.latest_readings[node.id] = reading

            if is_anomaly:
                failing_roots[node.id] = score
                # Record event
                event = EventModel(
                    id=str(uuid.uuid4())[:8],
                    timestamp=now_iso,
                    node_id=node.id,
                    node_name=node.name,
                    severity="critical" if score >= 0.80 else "warning",
                    event_type="SENSOR_ANOMALY",
                    message=f"{node.name}: {explanation}",
                    anomaly_score=score,
                    cascade_depth=0
                )
                self._record_event(event)

        # 2. CrisisGraph cascade percolation
        cascade_results = self.graph.simulate_cascade(failing_roots)

        # Record cascade warning events for impacted nodes
        for node_id, cascade_info in cascade_results.items():
            if cascade_info["cascade_impact"] >= 0.35:
                event = EventModel(
                    id=str(uuid.uuid4())[:8],
                    timestamp=now_iso,
                    node_id=node_id,
                    node_name=cascade_info["node_name"],
                    severity="critical" if cascade_info["cascade_impact"] >= 0.65 else "warning",
                    event_type="CASCADE_PROPAGATION",
                    message=(
                        f"Cascading stress warning on {cascade_info['node_name']} via "
                        f"{' -> '.join(cascade_info['causal_path'])}. Impact: {cascade_info['cascade_impact']:.2f}"
                    ),
                    anomaly_score=cascade_info["cascade_impact"],
                    cascade_depth=cascade_info["hop_distance"]
                )
                self._record_event(event)

        # 3. Calculate transparent composite risk scores
        new_risks: Dict[str, NodeRisk] = {}
        for node in self.graph.get_all_nodes():
            reading = self.latest_readings.get(node.id)
            direct_risk = reading.anomaly_score if reading else 0.0

            cascade_info = cascade_results.get(node.id)
            cascade_impact = cascade_info["cascade_impact"] if cascade_info else 0.0
            impacted_by = cascade_info["causal_path"][:-1] if cascade_info else []

            # Transparent formula: Criticality * Max(direct_risk, cascade_impact)
            effective_stress = max(direct_risk, cascade_impact)
            composite_risk = round(min(1.0, max(0.0, node.criticality * effective_stress)), 4)

            # Determine operational status
            if composite_risk >= 0.65:
                status = "critical"
            elif composite_risk >= 0.35:
                status = "warning"
            else:
                status = "nominal"

            # Explainable rationale breakdown
            if direct_risk >= 0.60:
                reason = f"High direct sensor anomaly ({direct_risk:.2f}) on internal telemetry."
            elif cascade_impact >= 0.35:
                reason = (
                    f"Elevated cascade exposure ({cascade_impact:.2f}) from upstream "
                    f"path: {' -> '.join(cascade_info['causal_path'])}."
                )
            else:
                reason = "Operating within acceptable risk envelope."

            new_risks[node.id] = NodeRisk(
                node_id=node.id,
                node_name=node.name,
                node_type=node.type,
                criticality=node.criticality,
                direct_risk=direct_risk,
                cascade_risk=cascade_impact,
                composite_risk=composite_risk,
                status=status,
                impacted_by=impacted_by,
                reasoning=reason
            )

        self.latest_risks = new_risks

    def _record_event(self, event: EventModel) -> None:
        """Appends an event and maintains history bounds."""
        self.recent_events.insert(0, event)
        if len(self.recent_events) > self.max_events_history:
            self.recent_events.pop()

    def get_events_response(self) -> EventsResponse:
        """Returns structured events response."""
        unresolved = sum(
            1 for r in self.latest_readings.values() if r.is_anomaly
        )
        # If no events have fired yet, produce an initial informational event
        events = list(self.recent_events)
        if not events:
            now_iso = datetime.now(timezone.utc).isoformat()
            events = [
                EventModel(
                    id="init_001",
                    timestamp=now_iso,
                    node_id="system",
                    node_name="SENTINEL Z Monitor",
                    severity="info",
                    event_type="SYSTEM_INITIALIZED",
                    message="CrisisGraph engine online. All infrastructure telemetry nominal.",
                    anomaly_score=0.0,
                    cascade_depth=0
                )
            ]

        return EventsResponse(
            total_events=len(events),
            unresolved_anomalies=unresolved,
            events=events
        )

    def get_risks_response(self) -> RisksResponse:
        """Returns structured system risk evaluation response."""
        risks_list = list(self.latest_risks.values())
        if not risks_list:
            self.step()
            risks_list = list(self.latest_risks.values())

        high_risk_count = sum(1 for r in risks_list if r.composite_risk >= 0.50)
        overall_risk = (
            round(sum(r.composite_risk for r in risks_list) / len(risks_list), 4)
            if risks_list else 0.0
        )

        # Sort risks descending by composite_risk
        sorted_risks = sorted(risks_list, key=lambda r: r.composite_risk, reverse=True)

        return RisksResponse(
            evaluated_at=datetime.now(timezone.utc).isoformat(),
            overall_system_risk=overall_risk,
            high_risk_node_count=high_risk_count,
            nodes_evaluated=len(sorted_risks),
            risks=sorted_risks
        )
