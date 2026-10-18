"""IsolationForest-based multivariate anomaly detector for infrastructure sensors."""
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


class AnomalyDetector:
    """Trained IsolationForest model for detecting multivariate sensor anomalies."""

    def __init__(self, contamination: float = 0.08, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100
        )
        self.feature_names = ["voltage_kv", "temperature_c", "load_percentage", "frequency_hz"]
        self.baseline_means = np.array([120.0, 42.0, 55.0, 60.0])
        self.baseline_stds = np.array([8.0, 6.0, 12.0, 0.05])
        self.is_fitted = False
        self._fit_baseline_distribution()

    def _generate_synthetic_baseline(self, n_samples: int = 1500) -> pd.DataFrame:
        """Generates representative normal telemetry distributions to train the detector."""
        rng = np.random.default_rng(self.random_state)
        voltages = rng.normal(loc=120.0, scale=3.5, size=n_samples)
        temps = rng.normal(loc=42.0, scale=4.0, size=n_samples)
        loads = rng.normal(loc=55.0, scale=10.0, size=n_samples)
        freqs = rng.normal(loc=60.0, scale=0.03, size=n_samples)

        df = pd.DataFrame({
            "voltage_kv": np.clip(voltages, 100.0, 140.0),
            "temperature_c": np.clip(temps, 25.0, 65.0),
            "load_percentage": np.clip(loads, 20.0, 80.0),
            "frequency_hz": np.clip(freqs, 59.85, 60.15)
        })
        return df

    def _fit_baseline_distribution(self) -> None:
        """Fits the IsolationForest model on the synthetic baseline."""
        baseline_df = self._generate_synthetic_baseline()
        self.model.fit(baseline_df[self.feature_names])
        self.is_fitted = True

    def score_telemetry(
        self,
        voltage_kv: float,
        temperature_c: float,
        load_percentage: float,
        frequency_hz: float
    ) -> Tuple[float, bool, str]:
        """
        Calculates an anomaly score between 0.0 and 1.0 and provides an explainable reason.

        Returns:
            Tuple of (anomaly_score [0.0, 1.0], is_anomaly, explanation)
        """
        features_df = pd.DataFrame(
            [[voltage_kv, temperature_c, load_percentage, frequency_hz]],
            columns=self.feature_names
        )
        # decision_function yields higher values for normal points and negative for anomalies
        raw_score = self.model.decision_function(features_df)[0]

        # Normalize score into [0.0, 1.0] where 1.0 is extremely anomalous
        # Typical raw_score is in range [-0.3, +0.3]
        normalized_score = float(1.0 / (1.0 + np.exp(raw_score * 10.0)))
        normalized_score = round(float(np.clip(normalized_score, 0.0, 1.0)), 4)

        is_anomaly = normalized_score >= 0.60

        # Determine dominant deviating feature
        raw_values = np.array([voltage_kv, temperature_c, load_percentage, frequency_hz])
        z_scores = np.abs((raw_values - self.baseline_means) / self.baseline_stds)
        max_idx = int(np.argmax(z_scores))
        leading_feature = self.feature_names[max_idx]

        if is_anomaly:
            if leading_feature == "temperature_c":
                reason = f"Thermal elevation ({temperature_c:.1f}°C) exceeds normal operating envelope."
            elif leading_feature == "load_percentage":
                reason = f"Electrical load strain ({load_percentage:.1f}%) approaching rating limit."
            elif leading_feature == "voltage_kv":
                reason = f"Voltage excursion ({voltage_kv:.1f} kV) deviated from nominal baseline."
            else:
                reason = f"Frequency instability ({frequency_hz:.2f} Hz) indicating grid stress."
        else:
            reason = "Operating parameters within nominal tolerance intervals."

        return normalized_score, is_anomaly, reason
