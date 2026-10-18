# SENTINEL Z: AI for Predicting Cascading Infrastructure Failures

[![IBM Z Datathon 2026](https://img.shields.io/badge/IBM%20Z%20Datathon-2026-blue.svg)](https://www.ibm.com/community/z/)
[![Theme](https://img.shields.io/badge/Theme-Real--Time%20AI%20for%20Critical%20Decisions-darkgreen.svg)]()
[![Core Engine](https://img.shields.io/badge/Core%20Engine-CrisisGraph-orange.svg)]()
[![Platform](https://img.shields.io/badge/Platform-IBM%20LinuxONE%20%7C%20s390x%20Ready-purple.svg)]()

> **Real-Time AI for Critical Decisions**: An operational, explainable decision-support dashboard that simulates municipal critical infrastructure, detects multivariate sensor anomalies using Machine Learning, predicts cascading failure propagation across dependent systems using **CrisisGraph**, and evaluates counterfactual preventive interventions in real time.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Key Capabilities](#key-capabilities)
3. [Architecture & LinuxONE Readiness](#architecture--linuxone-readiness)
4. [Technology Stack](#technology-stack)
5. [Repository Structure](#repository-structure)
6. [Getting Started (Local Development)](#getting-started-local-development)
7. [Running Automated Tests](#running-automated-tests)
8. [Live Demonstration Script](#live-demonstration-script)
9. [Engineering Principles & Disclaimers](#engineering-principles--disclaimers)
10. [Documentation Index](#documentation-index)

---

## 1. Project Overview

Modern urban infrastructure is intrinsically interdependent. An electrical substation overload does not merely cause localized power flickers—it cascades into communications hubs, disables regional traffic light grids, and strains trauma hospital emergency backup generators.

**SENTINEL Z** equips municipal operators and emergency coordinators with real-time decision intelligence:
- **Continuous Telemetry Simulation**: Emulates multi-signal telemetry (voltage, temperature, load, frequency/vibration) across interconnected infrastructure nodes.
- **Unsupervised Anomaly Detection**: Employs `IsolationForest` to flag early thermal degradation or operational stress before physical failure occurs.
- **Topological Cascade Propagation (CrisisGraph)**: Uses directed graph dependency models to project failure propagation, taking into account coupling strength, redundancy feeds, and component criticality.
- **Explainable Counterfactual Interventions**: Simulates mitigating actions (load rerouting, controlled component isolation, emergency generator activation) and computes net risk reduction before operators commit to physical switching.

---

## 2. Key Capabilities

| Capability | How It Works | Operator Value |
| :--- | :--- | :--- |
| **CrisisGraph Topology** | Attributed directed graph in NetworkX modeling substations, transformers, hospitals, traffic control, and comms hubs | Eliminates blind spots in cross-sector dependencies |
| **Real-Time ML Anomaly Detection** | `scikit-learn IsolationForest` running continuous inference over dynamic telemetry vectors | Detects pre-failure operational drift before alarms sound |
| **Attenuated Cascade Simulation** | Calculates path-based risk percolation incorporating hop attenuation and redundant power feeds | Accurately forecasts downstream impacts without over-predicting |
| **Explainable Risk Reasoning** | Deterministic causal chain generator explaining *why* each downstream node is threatened | Transparent rationale for mission-critical command centers |
| **Intervention Benchmarking** | Side-by-side counterfactual simulation (e.g., Reroute Load vs. Island Component) | Quantifiable risk delta ($\Delta \text{Risk}$) to choose optimal action |
| **Live WebSocket Streaming** | Bi-directional WebSocket stream with automatic reconnection and HTTP polling fallback | Millisecond-level synchronization of sensor charts and graph state |

---

## 3. Architecture & LinuxONE Readiness

SENTINEL Z is designed specifically with the **IBM LinuxONE** and **IBM Z** ecosystem in mind:
- **Ultra-Low Memory Footprint**: In-memory state and optimized graph traversal require $< 250\text{MB}$ RAM, enabling dense container hosting on LinuxONE LPARs.
- **Vector & In-Memory ML**: Scikit-learn and NumPy routines run natively on s390x architecture without proprietary GPU dependencies.
- **Continuous Availability**: Stateless API architecture with resilient fallback mechanisms ensures continuous operations during network partitioning.
- **OCI Container Standards**: Multi-stage Dockerfile ready for deployment on Red Hat OpenShift on IBM Z or enterprise Linux.

Detailed architectural diagrams and mathematical formulations are available in [`docs/architecture.md`](file:///c:/Users/P%20S%20RAM/Desktop/ibm/docs/architecture.md).

---

## 4. Technology Stack

- **Frontend**:
  - React 18 & Vite
  - JavaScript (ES2022)
  - **React Flow**: High-performance interactive graph visualization with custom node components
  - **Recharts**: Responsive real-time sensor telemetry time-series charts
  - Modern CSS (Custom Design System with Dark Mode, Glassmorphism, and Fluid Transitions)
- **Backend**:
  - Python 3.11+
  - **FastAPI** & **Uvicorn**: High-throughput asynchronous REST and WebSocket API
  - **NetworkX**: Directed graph dependency modeling and path percolation
  - **scikit-learn**: Unsupervised `IsolationForest` anomaly detector
  - **NumPy** & **Pandas**: High-speed numerical calculations
- **Testing & Quality**:
  - `pytest` & `httpx`: Automated backend test suite
  - Vite build verification for frontend

---

## 5. Repository Structure

```
sentinel-z/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI entry point & lifespan
│   │   ├── config.py                  # Operational thresholds & parameters
│   │   ├── api/                       # REST & WebSocket routes
│   │   ├── core/                      # In-memory state store & simulation scheduler
│   │   ├── engine/                    # CrisisGraph, Risk Model & Intervention Simulator
│   │   ├── ml/                        # IsolationForest & synthetic telemetry generator
│   │   └── models/                    # Pydantic schemas and contracts
│   ├── tests/                         # Pytest automated test suite
│   ├── requirements.txt               # Backend dependencies
│   └── Dockerfile                     # s390x-ready container definition
├── frontend/
│   ├── src/
│   │   ├── components/                # React Flow canvas, Recharts, controls
│   │   ├── services/                  # API client & WebSocket streaming manager
│   │   ├── styles/                    # Modern responsive CSS design system
│   │   ├── App.jsx                    # Root dashboard assembly
│   │   └── main.jsx                   # React mounting point
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── architecture.md                # System topology, data flow, math models
│   ├── implementation_plan.md         # Phased roadmap & testing gates
│   └── api_contract.md                # REST & WebSocket endpoint specifications
└── README.md
```

---

## 6. Getting Started (Local Development)

### Prerequisites
- Python 3.10+ (Python 3.11 recommended)
- Node.js 18+ and npm
- Git

### Step 1: Clone and Set Up Backend
```bash
# Navigate to the backend directory
cd backend

# Create and activate a Python virtual environment
python -m venv venv

# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server (development mode)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend will be available at: `http://localhost:8000` (Interactive Swagger Docs at `http://localhost:8000/docs`).

### Step 2: Set Up Frontend
```bash
# In a separate terminal, navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
Frontend dashboard will be available at: `http://localhost:5173`.

---

## 7. Running Automated Tests

Following the phase-gated engineering methodology, test suites must pass before deployment:

```bash
# Run backend test suite
cd backend
pytest -v tests/
```

Test coverage includes:
- Graph topology validation and downstream traversal
- Machine learning anomaly score calibration on normal vs. degraded telemetry
- Cascade propagation mathematics and redundancy attenuation
- Counterfactual intervention risk reduction calculations
- REST endpoints and WebSocket streaming lifecycle

---

## 8. Live Demonstration Script

To showcase SENTINEL Z during an evaluation or hackathon presentation:

### Phase 1: Baseline Nominal State (0:00 - 1:00)
1. Open the dashboard at `http://localhost:5173`.
2. Observe all infrastructure nodes glowing green (nominal status).
3. Point out the live telemetry stream showing stable voltage (~138 kV), safe operating temperatures (~45 °C), and balanced load (~60%).
4. Explain the dependency graph structure: Power Grid (Alpha, Beta, T-1, T-2) $\rightarrow$ Civic Infrastructure (Metro General Hospital, Metro Traffic Control, Fiber Hub).

### Phase 2: Fault Injection & Anomaly Detection (1:00 - 2:00)
1. In the **Fault Injection Panel**, select `Substation Alpha` and click **"Simulate Thermal Runaway"**.
2. Point out the real-time Recharts panel: Temperature spikes toward 95 °C and load surges.
3. Show the `IsolationForest` anomaly score crossing the $0.70$ threshold, turning Substation Alpha red.
4. Highlight the **CrisisGraph Cascade Projection**:
   - Transformer T-1 transitions to Amber warning.
   - Metro General Hospital triggers an alert due to compromised primary feed.
   - Explain the causal explanation banner generated transparently by the engine.

### Phase 3: Counterfactual Intervention Evaluation (2:00 - 3:00)
1. Open the **Intervention Workbench**.
2. Select candidate action: **"Reroute Transformer T-1 to Substation Beta + Dispatch Hospital Backup"**.
3. View the **Scenario Comparison Matrix**:
   - Baseline Projected Risk: `0.74`
   - Mitigated Projected Risk: `0.28`
   - Net Risk Reduction: `62.16%`
4. Click **"Execute Intervention"**.
5. Observe the React Flow canvas dynamically update: load lines reroute to Substation Beta, Hospital shifts to secure backup state, and system cascade alert drops back to nominal.

---

## 9. Engineering Principles & Disclaimers

> [!IMPORTANT]
> **Engineering & Competition Disclaimers**:
> 1. **Synthetic Data**: All telemetry data, sensor readings, and infrastructure topologies are purely synthetic simulations designed for decision-support prototyping. SENTINEL Z does not interface with actual municipal utility grids, hospitals, or emergency networks.
> 2. **Transparent Heuristic Risk**: Risk scores and cascade percentages are deterministic heuristic operational indices based on graph coupling and ML anomaly severity. They do not claim to represent calibrated real-world failure probabilities.
> 3. **Explainable AI**: The system avoids opaque "black-box" decision-making; every alert and recommendation is backed by a verifiable topological dependency path.

---

## 10. Documentation Index

- [Architecture & Data Flow](file:///c:/Users/P%20S%20RAM/Desktop/ibm/docs/architecture.md)
- [Implementation Plan & Roadmap](file:///c:/Users/P%20S%20RAM/Desktop/ibm/docs/implementation_plan.md)
- [API Contract Specification](file:///c:/Users/P%20S%20RAM/Desktop/ibm/docs/api_contract.md)
