"""Configuration settings for SENTINEL Z backend."""
from pathlib import Path
from pydantic import BaseModel
from typing import List


class Settings(BaseModel):
    app_name: str = "SENTINEL Z"
    version: str = "1.0.0"
    debug: bool = True
    
    # Path Resolution
    # Base directory is repo root if data folder is found, or relative to backend
    root_dir: Path = Path(__file__).resolve().parent.parent.parent
    data_file_path: Path = root_dir / "data" / "infrastructure.json"

    # CORS Configuration
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Anomaly Detection & ML Defaults
    isolation_forest_contamination: float = 0.08
    random_seed: int = 42
    anomaly_threshold: float = 0.60
    critical_anomaly_threshold: float = 0.80

    # CrisisGraph Cascade Damping
    cascade_damping_factor: float = 0.85


settings = Settings()

# Validate data file path fallback if running from alternative directories
if not settings.data_file_path.exists():
    fallback_path = Path(__file__).resolve().parent.parent / "data" / "infrastructure.json"
    if fallback_path.exists():
        settings.data_file_path = fallback_path
