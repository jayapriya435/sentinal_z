# SENTINEL Z — Implementation Plan & Engineering Roadmap

**Project**: SENTINEL Z — AI for Predicting Cascading Infrastructure Failures  
**Core Engine**: CrisisGraph  
**Methodology**: Test-Driven, Phase-Gated Engineering  

---

## 1. Guiding Principles & Phase Gates

To ensure software reliability, mathematical explainability, and adherence to competition constraints:
1. **Zero Hardcoded Fakes**: Every scenario, metric, and risk score must derive dynamically from the graph topology, telemetry generator, and ML inference.
2. **Phase Gating**: Each phase must achieve 100% test pass rates and verification before advancing to the subsequent phase.
3. **Transparent Heuristics**: Anomaly and cascade scores are presented as deterministic, normalized operational risk indices, not misleading real-world probability distributions.
4. **Resilient LinuxONE Compatibility**: All code must run natively in Python 3.11 / Node 20 environments without proprietary hardware drivers or paid external cloud APIs.

---

## 2. Phase-by-Phase Roadmap

### Phase 1: Foundation & Project Scaffolding
* **Objectives**:
  - Establish Python backend virtual environment and dependency tree (`requirements.txt`: FastAPI, Uvicorn, NetworkX, scikit-learn, NumPy, Pandas, pytest, httpx, websockets).
  - Scaffold React + Vite frontend application (`package.json`: React, React Flow, Recharts, Lucide-React / modern icon set).
  - Configure backend project structure (`app/core`, `app/engine`, `app/ml`, `app/api`, `app/models`, `tests`).
  - Configure frontend directory layout and modern CSS design tokens (dark-mode first, glassmorphism, high-contrast operational colors).
* **Deliverables**:
  - `backend/requirements.txt` & verified virtual environment.
  - `backend/app/main.py` health check endpoint (`GET /health`).
  - `frontend/package.json` & Vite dev server boots cleanly.
* **Testing Gate**:
  - `pytest tests/test_health.py` passes with HTTP 200.
  - Frontend builds with zero syntax errors.

---

### Phase 2: CrisisGraph Core & NetworkX Topology
* **Objectives**:
  - Implement `app/engine/crisis_graph.py` with the complete infrastructure topology model.
  - Define nodes with realistic operational parameters:
    - **Substations**: Alpha Transmission Station (High Capacity), Beta Regional Substation.
    - **Transformers**: Step-Down Transformer T-1, T-2.
    - **Hospitals**: Metro General Hospital (Trauma Center, Criticality 5.0), St. Jude Community Clinic (Criticality 3.5).
    - **Traffic Systems**: Central Metro Traffic Control (Criticality 3.0), Transit Corridor Grid.
    - **Communication Hubs**: Fiber Backbone Central Hub (Criticality 4.5), Cellular Tower Array A/B.
    - **Emergency Facilities**: Regional Water Pumping Station, Central Dispatch & Fire Command.
  - Define directional edges with coupling strength, transfer capacity, and redundancy factors (e.g. backup feeds, dual-ring routing).
  - Implement path traversal methods: downstream reachability, critical path finding, and cycle detection.
* **Deliverables**:
  - `backend/app/engine/crisis_graph.py` class `CrisisGraphEngine`.
  - Node & edge schema definitions in `app/models/graph_models.py`.
* **Testing Gate**:
  - `pytest tests/test_crisis_graph.py` verifying:
    - Node counts and edge connectivity.
    - Downstream dependency retrieval matches expected graph hierarchy.
    - Graph serialization to dictionary/JSON format matches API contract.

---

### Phase 3: Telemetry Simulator & Isolation Forest Anomaly Detection
* **Objectives**:
  - Implement `app/ml/synthetic_generator.py`: Generates continuous physical metrics per node:
    - Voltage (kV / V with random Gaussian noise).
    - Temperature (°C with dynamic heat accumulation under load).
    - Load percentage (0% to 150%+ during overload).
    - Frequency / Vibration deviation (Hz).
  - Implement fault injection mechanisms: manual spikes, gradual thermal runaway, line trips, cyber-induced signal oscillation.
  - Implement `app/ml/anomaly_detector.py`:
    - Trains an `IsolationForest` on normal operational envelopes.
    - Computes real-time anomaly scores $\in [0, 1]$ per component.
    - Tags binary anomaly threshold triggers (e.g., score $> 0.65$).
* **Deliverables**:
  - `backend/app/ml/synthetic_generator.py`
  - `backend/app/ml/anomaly_detector.py`
* **Testing Gate**:
  - `pytest tests/test_anomaly_detector.py` verifying:
    - Baseline sensor data generates low anomaly scores ($< 0.40$).
    - Injected voltage/temperature faults produce high anomaly scores ($> 0.70$).
    - Fast batch inference performance ($< 20\text{ms}$ execution time).

---

### Phase 4: Cascading Failure Simulation & Intervention Engine
* **Objectives**:
  - Implement `app/engine/risk_model.py`:
    - Mathematical cascade propagation algorithm using hop attenuation and redundancy mitigation.
    - Transparent risk score formulation:
      $$\text{Risk}(d) = W_d \times \left( 1 - \prod_{p \in \text{Paths}(s, d)} (1 - \text{CascadeImpact}_p) \right)$$
    - Explainable cascade reasoning: Generates human-readable explanations of why each downstream component is at risk (e.g., "Node Alpha failed $\rightarrow$ Primary link lost $\rightarrow$ St. Jude on single redundant feed at 85% capacity").
  - Implement `app/engine/interventions.py`:
    - Candidate actions:
      1. **Load Rerouting**: Transfer load from degraded link to parallel branch.
      2. **Component Isolation (Islanding)**: Trip link before surge reaches sensitive node.
      3. **Load Shedding**: Cut non-essential nodes to stabilize feeder.
      4. **Backup Activation**: Switch critical node to diesel / battery backup.
    - Evaluates baseline vs. intervention counterfactuals using identical risk equations.
    - Calculates Net Risk Delta and collateral trade-offs.
* **Deliverables**:
  - `backend/app/engine/risk_model.py`
  - `backend/app/engine/interventions.py`
* **Testing Gate**:
  - `pytest tests/test_risk_model.py` & `pytest tests/test_interventions.py` verifying:
    - Cascade reaches expected downstream nodes based on topology.
    - Isolated nodes prevent cascade progression past the isolation boundary.
    - Risk scores mathematically decrease under successful intervention.

---

### Phase 5: REST & WebSocket API Integration
* **Objectives**:
  - Implement FastAPI routing:
    - `GET /api/v1/graph`: Graph topology & node metadata.
    - `GET /api/v1/telemetry/latest`: Latest sensor readings and anomaly states.
    - `POST /api/v1/telemetry/inject`: Trigger fault/stress on selected node.
    - `POST /api/v1/telemetry/reset`: Reset state to nominal conditions.
    - `POST /api/v1/simulate/cascade`: Run on-demand cascade simulation.
    - `POST /api/v1/simulate/interventions`: Compare intervention counterfactuals.
    - `GET /api/v1/recommendations`: Top ranked explainable actions.
    - `WS /ws/telemetry`: Streaming updates (telemetry, alerts, cascade state) at 1 Hz.
  - Implement background simulation scheduler (`app/core/scheduler.py`).
  - Add request validation, error handlers, and CORS configuration.
* **Deliverables**:
  - Fully functional FastAPI backend service.
* **Testing Gate**:
  - `pytest tests/test_api.py` covering:
    - All REST endpoints with valid and invalid inputs.
    - WebSocket connection, message format, and broadcast verification.

---

### Phase 6: Frontend Dashboard & Visual Experience
* **Objectives**:
  - Build modern, high-tech command center interface:
    - **Header**: Live status indicators, global cascade alert level, LinuxONE execution banner.
    - **Topology Canvas (`React Flow`)**: Custom nodes (Substations, Transformers, Hospitals, etc.) with animated borders, dynamic risk badges, and glowing cascade edges.
    - **Telemetry Panel (`Recharts`)**: Real-time line charts showing Voltage, Temp, and Load with anomaly threshold markers.
    - **Cascade Explainer Panel**: Interactive list detailing cascade depth, ETA/buffer time, and step-by-step causal chain.
    - **Intervention Workbench**: Scenario comparison table comparing Baseline vs. Mitigated metrics, with "Execute Intervention" trigger.
    - **Fault Injection Bar**: Interactive buttons to simulate "Substation Overload", "Transformer Surge", "Grid Heatwave", or custom node faults.
  - Ensure full empty states, loading indicators, and error resilience.
* **Deliverables**:
  - Complete, responsive React + Vite application.
* **Testing Gate**:
  - End-to-end frontend build check (`npm run build`).
  - Interactive validation with backend WebSocket stream active.

---

### Phase 7: Verification, Automated Testing, LinuxONE Packaging & Demo Script
* **Objectives**:
  - Run full automated test suite (backend pytest + frontend build).
  - Package multi-architecture container (`Dockerfile` tested for s390x / Linux compatibility).
  - Author comprehensive demonstration script with timed scenarios:
    - Scenario 1: Nominal Operations (All green, baseline AI monitoring).
    - Scenario 2: Thermal Runaway at Substation Alpha (Anomaly detected, cascade warning on Hospital & Comms).
    - Scenario 3: Real-Time Intervention (Rerouting load to Substation Beta, isolating feeder, cascade averted).
* **Deliverables**:
  - Clean test run logs.
  - Production container build instructions.
  - Detailed Demo Walkthrough script in `README.md`.

---

## 3. Engineering Quality Checklist

| Requirement | Implementation Detail | Status |
| :--- | :--- | :--- |
| **Zero Hardcoded Demos** | All cascade paths computed via NetworkX Dijkstra/BFS algorithms | Planned |
| **Real Anomaly Detection** | IsolationForest model evaluates live multi-dimensional telemetry | Planned |
| **Transparent Risk Scores** | Explicit algebraic formulation combining coupling, redundancy, and criticality | Planned |
| **Live Streaming** | WebSocket protocol with automatic reconnect & fallback polling | Planned |
| **Interactive Interventions** | Real-time counterfactual simulation comparing baseline vs. action | Planned |
| **LinuxONE Ready** | Clean s390x-compatible Python stack with minimal memory footprint | Planned |
