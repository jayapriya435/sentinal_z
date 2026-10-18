"""Synthetic Telemetry Simulator for municipal infrastructure nodes."""
from typing import Dict, Any, Optional
import time
from datetime import datetime, timezone
import numpy as np

from app.models import SensorReading, NodeModel


class SyntheticTelemetrySimulator:
    """Generates continuous physical sensor telemetry with stochastic noise and fault injection."""

    def __init__(self, random_seed: int = 42):
        self.rng = np.random.default_rng(random_seed)
        self.active_faults: Dict[str, Dict[str, Any]] = {}

        # Nominal baselines per node type
        self.type_baselines: Dict[str, Dict[str, float]] = {
            "substation": {"voltage": 120.0, "temp": 44.0, "load": 62.0, "freq": 60.0},
            "transformer": {"voltage": 118.0, "temp": 46.0, "load": 58.0, "freq": 60.0},
            "hospital": {"voltage": 120.0, "temp": 38.0, "load": 50.0, "freq": 60.0},
            "traffic_system": {"voltage": 120.0, "temp": 36.0, "load": 42.0, "freq": 60.0},
            "communication_hub": {"voltage": 120.0, "temp": 40.0, "load": 54.0, "freq": 60.0},
            "emergency_facility": {"voltage": 120.0, "temp": 39.0, "load": 48.0, "freq": 60.0},
        }

    def inject_fault(
        self,
        node_id: str,
        scenario: str = "thermal_runaway",
        intensity: float = 0.85,
        duration_seconds: int = 60
    ) -> None:
        """Injects a simulated sensor stress or hardware fault scenario."""
        self.active_faults[node_id] = {
            "scenario": scenario,
            "intensity": min(1.0, max(0.1, intensity)),
            "expires_at": time.time() + duration_seconds
        }

    def clear_faults(self) -> None:
        """Clears all active fault injections."""
        self.active_faults.clear()

    def generate_reading(self, node: NodeModel) -> Dict[str, float]:
        """Generates a single telemetry reading for a node, applying active faults if present."""
        now = time.time()
        base = self.type_baselines.get(
            node.type,
            {"voltage": 120.0, "temp": 40.0, "load": 50.0, "freq": 60.0}
        )

        # Baseline noise (Gaussian)
        voltage = float(self.rng.normal(base["voltage"], 0.8))
        temp = float(self.rng.normal(base["temp"], 1.0))
        load = float(self.rng.normal(base["load"], 2.5))
        freq = float(self.rng.normal(base["freq"], 0.02))

        # Check for active faults
        fault = self.active_faults.get(node.id)
        if fault and now < fault["expires_at"]:
            intensity = fault["intensity"]
            scenario = fault["scenario"]

            if scenario == "thermal_runaway":
                # Temperature spikes rapidly, load elevates
                temp += 45.0 * intensity
                load += 35.0 * intensity
                voltage -= 6.0 * intensity
                freq -= 0.12 * intensity
            elif scenario == "overload_surge":
                # Severe load surge
                load += 55.0 * intensity
                temp += 28.0 * intensity
                freq -= 0.18 * intensity
            elif scenario == "voltage_sag":
                # Significant brownout
                voltage -= 28.0 * intensity
                load += 15.0 * intensity
            elif scenario == "trip":
                # Full line drop
                voltage = 0.0
                load = 0.0
                freq = 0.0
                temp -= 15.0 * intensity
        elif fault and now >= fault["expires_at"]:
            # Expired fault
            del self.active_faults[node.id]

        return {
            "voltage_kv": round(voltage, 2),
            "temperature_c": round(temp, 2),
            "load_percentage": round(max(0.0, load), 2),
            "frequency_hz": round(freq, 3),
        }
