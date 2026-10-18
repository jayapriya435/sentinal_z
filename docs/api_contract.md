# SENTINEL Z — API Contract Specification

**Version**: 1.0.0  
**Base URL**: `http://localhost:8000`  
**WebSocket URL**: `ws://localhost:8000/ws/telemetry`  
**Data Format**: JSON (`application/json`)  

---

## 1. Overview & Conventions

All REST endpoints adhere to standard HTTP status codes:
- `200 OK`: Successful retrieval or execution.
- `400 Bad Request`: Validation failure or unknown node/parameter.
- `422 Unprocessable Entity`: Schema validation error (Pydantic).
- `500 Internal Server Error`: Unhandled server exception with structured error envelope.

### Standard Error Response Format
```json
{
  "error": {
    "code": "INVALID_NODE_ID",
    "message": "Node 'substation_gamma' does not exist in the active topology.",
    "timestamp": "2026-10-18T12:00:00Z"
  }
}
```

---

## 2. Endpoints

### 2.1 System Health
`GET /health`

**Description**: Liveness and readiness probe for container orchestrators and LinuxONE monitoring.

**Response**: `200 OK`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime_seconds": 342.5,
  "active_nodes": 12,
  "active_edges": 16,
  "timestamp": "2026-10-18T12:00:00Z"
}
```

---

### 2.2 Infrastructure Topology
`GET /api/v1/graph`

**Description**: Returns the active infrastructure dependency graph, including node metadata, operational boundaries, and directed dependency edges.

**Response**: `200 OK`
```json
{
  "nodes": [
    {
      "id": "substation_alpha",
      "label": "Alpha Transmission Substation",
      "type": "substation",
      "criticality": 4.5,
      "nominal_capacity": "500 MVA",
      "backup_power": false,
      "backup_fuel_hours": 0.0,
      "coordinates": {"x": 100, "y": 200},
      "status": "nominal"
    },
    {
      "id": "hospital_metro",
      "label": "Metro General Hospital",
      "type": "hospital",
      "criticality": 5.0,
      "nominal_capacity": "Level 1 Trauma (800 beds)",
      "backup_power": true,
      "backup_fuel_hours": 12.0,
      "coordinates": {"x": 500, "y": 150},
      "status": "nominal"
    }
  ],
  "edges": [
    {
      "id": "edge_sub_alpha_to_t1",
      "source": "substation_alpha",
      "target": "transformer_t1",
      "dependency_type": "power",
      "coupling_strength": 0.95,
      "redundancy_level": 0.20,
      "transfer_capacity_mva": 250.0,
      "status": "active"
    }
  ],
  "metadata": {
    "node_count": 12,
    "edge_count": 16,
    "graph_type": "DirectedAcyclicDependencyGraph"
  }
}
```

---

### 2.3 Latest Telemetry & Anomaly State
`GET /api/v1/telemetry/latest`

**Description**: Returns the most recent sensor telemetry readings and IsolationForest anomaly scores for every node.

**Response**: `200 OK`
```json
{
  "timestamp": "2026-10-18T12:00:01Z",
  "readings": {
    "substation_alpha": {
      "node_id": "substation_alpha",
      "voltage_kv": 138.2,
      "temperature_c": 74.8,
      "load_percentage": 92.4,
      "frequency_hz": 59.98,
      "anomaly_score": 0.78,
      "is_anomaly": true,
      "severity": "high",
      "updated_at": "2026-10-18T12:00:01Z"
    },
    "hospital_metro": {
      "node_id": "hospital_metro",
      "voltage_kv": 0.48,
      "temperature_c": 22.1,
      "load_percentage": 64.0,
      "frequency_hz": 60.01,
      "anomaly_score": 0.12,
      "is_anomaly": false,
      "severity": "nominal",
      "updated_at": "2026-10-18T12:00:01Z"
    }
  },
  "overall_system_risk": 0.42
}
```

---

### 2.4 Fault & Stress Injection
`POST /api/v1/telemetry/inject`

**Description**: Injects a controlled operational stress or hardware fault scenario into synthetic telemetry generation.

**Request Payload**:
```json
{
  "node_id": "substation_alpha",
  "scenario": "thermal_runaway",
  "duration_seconds": 60,
  "intensity": 0.85,
  "parameters": {
    "target_temperature_c": 115.0,
    "target_load_percentage": 145.0
  }
}
```

*Supported Scenarios*:
- `thermal_runaway`: Rapid temperature escalation and cooling failure.
- `overload_surge`: Load percentage exceeds 130%, inducing frequency fluctuations.
- `voltage_drop`: Severe brownout condition ($< 0.85$ p.u.).
- `complete_trip`: Hardware cut-off, immediate power loss.

**Response**: `200 OK`
```json
{
  "status": "injected",
  "node_id": "substation_alpha",
  "scenario": "thermal_runaway",
  "active_until": "2026-10-18T12:01:01Z",
  "message": "Thermal runaway injected into Substation Alpha. Sensor telemetry updating."
}
```

---

### 2.5 Reset Telemetry & Interventions
`POST /api/v1/telemetry/reset`

**Description**: Clears active fault injections, restores nominal telemetry generation, and resets any executed interventions to baseline topology.

**Response**: `200 OK`
```json
{
  "status": "reset_successful",
  "message": "Telemetry and topology reset to nominal baseline state."
}
```

---

### 2.6 Cascade Simulation
`POST /api/v1/simulate/cascade`

**Description**: Computes downstream cascading impact across the dependency graph starting from one or more failing or degraded root nodes.

**Request Payload**:
```json
{
  "source_nodes": ["substation_alpha"],
  "damping_factor": 0.85,
  "include_reasoning": true
}
```

**Response**: `200 OK`
```json
{
  "root_nodes": ["substation_alpha"],
  "simulation_timestamp": "2026-10-18T12:00:02Z",
  "total_affected_nodes": 4,
  "system_cascade_risk": 0.74,
  "affected_nodes": [
    {
      "node_id": "transformer_t1",
      "label": "Step-Down Transformer T-1",
      "type": "transformer",
      "hop_distance": 1,
      "cascade_impact": 0.81,
      "composite_risk_score": 0.77,
      "status": "critical",
      "causal_path": ["substation_alpha", "transformer_t1"],
      "explanation": "Direct power feeder from Substation Alpha compromised. Transformer T-1 operating without secondary feed."
    },
    {
      "node_id": "hospital_metro",
      "label": "Metro General Hospital",
      "type": "hospital",
      "hop_distance": 2,
      "cascade_impact": 0.65,
      "composite_risk_score": 0.82,
      "status": "warning",
      "causal_path": ["substation_alpha", "transformer_t1", "hospital_metro"],
      "explanation": "Primary power feed at Transformer T-1 failing. On-site generator available for 12 hours before fuel exhaustion."
    }
  ]
}
```

---

### 2.7 Intervention Evaluation & Comparison
`POST /api/v1/simulate/interventions`

**Description**: Evaluates one or more candidate mitigating actions against the baseline cascade scenario using identical risk formulations.

**Request Payload**:
```json
{
  "failing_nodes": ["substation_alpha"],
  "interventions": [
    {
      "action_type": "reroute_load",
      "source_node": "transformer_t1",
      "target_node": "substation_beta",
      "load_mva": 120.0
    },
    {
      "action_type": "isolate_component",
      "node_id": "substation_alpha"
    },
    {
      "action_type": "activate_backup",
      "node_id": "hospital_metro"
    }
  ]
}
```

**Response**: `200 OK`
```json
{
  "baseline_risk": 0.74,
  "mitigated_risk": 0.28,
  "risk_reduction_pct": 62.16,
  "scenarios": [
    {
      "name": "Baseline (No Action)",
      "aggregate_risk": 0.74,
      "critical_nodes_at_risk": 3,
      "projected_downtime_hours": 8.5
    },
    {
      "name": "Intervention Strategy A (Reroute + Hospital Backup)",
      "aggregate_risk": 0.28,
      "critical_nodes_at_risk": 0,
      "projected_downtime_hours": 0.0,
      "collateral_impact": "Substation Beta utilization increases from 45% to 78% (within rated headroom).",
      "recommended": true
    }
  ]
}
```

---

### 2.8 Action Recommendations
`GET /api/v1/recommendations`

**Description**: Returns algorithmically ranked preventive and mitigating actions based on the current live state of anomalies and cascade risks.

**Response**: `200 OK`
```json
{
  "generated_at": "2026-10-18T12:00:03Z",
  "recommendations": [
    {
      "priority": 1,
      "action_type": "reroute_load",
      "title": "Reroute Transformer T-1 to Substation Beta",
      "target_nodes": ["transformer_t1", "substation_beta"],
      "estimated_risk_reduction": "62%",
      "reasoning": "Substation Alpha thermal anomaly indicates imminent trip. Substation Beta has 130 MVA headroom to absorb T-1 load."
    },
    {
      "priority": 2,
      "action_type": "preemptive_backup_start",
      "title": "Spin Up Metro General Emergency Generators",
      "target_nodes": ["hospital_metro"],
      "estimated_risk_reduction": "25%",
      "reasoning": "Prevents instantaneous blackout transition for Level 1 Trauma ICU during potential feeder switchover."
    }
  ]
}
```

---

## 3. Real-Time WebSocket Streaming

### 3.1 Connection
`WS /ws/telemetry`

Client initiates a standard WebSocket handshake. Upon connection:
- Server sends initial handshake ack with current graph state summary.
- Server broadcasts periodic telemetry frames at **1 Hz (1000ms interval)**.
- Client can send control messages (such as trigger injection or request immediate refresh).

### 3.2 Inbound Message (Client -> Server)
```json
{
  "type": "INJECT_FAULT",
  "payload": {
    "node_id": "substation_alpha",
    "scenario": "thermal_runaway"
  }
}
```

### 3.3 Outbound Message (Server -> Client)
```json
{
  "type": "TELEMETRY_UPDATE",
  "timestamp": "2026-10-18T12:00:04Z",
  "readings": {
    "substation_alpha": {
      "voltage_kv": 137.9,
      "temperature_c": 82.3,
      "load_percentage": 98.1,
      "frequency_hz": 59.96,
      "anomaly_score": 0.84,
      "is_anomaly": true
    }
  },
  "cascade_alert": {
    "active": true,
    "root_cause": "substation_alpha",
    "composite_risk": 0.76,
    "top_affected_node": "hospital_metro"
  }
}
```
