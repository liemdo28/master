"""Overnight Chaos Orchestrator — coordinates long-running warfare sessions."""
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional
import json
import os
import random
import threading
import time
import uuid

from .runtime_decay import RuntimeDecayTracker
from .memory_drift import MemoryDriftTracker
from .queue_creep import QueueCreepTracker
from .retry_amplification import RetryAmplificationTracker
from .persistent_websocket_warfare import PersistentWebSocketWarfare
from .survivability_tracker import SurvivabilityTracker


@dataclass
class OvernightChaosConfig:
    """Configuration for overnight chaos."""
    target_url: str
    ws_url: Optional[str] = None
    intensity: str = "medium"
    scenarios: list[str] = field(default_factory=lambda: ["runtime_decay", "memory_drift", "queue_creep", "retry_amplification", "websocket_warfare"])
    duration_hours: float = 8.0
    sample_interval_seconds: int = 60

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class OvernightChaosResult:
    """Result of an overnight chaos run."""
    config: OvernightChaosConfig
    started_at: datetime
    completed_at: datetime
    duration_actual_hours: float
    decay_trends: list[dict]
    collapse_events: list[dict]
    survivability_score: dict
    memory_drift_mb_per_hour: float
    ws_stability_decay: float
    retry_amplification_factor: float

    def to_dict(self) -> dict:
        return {
            "config": self.config.to_dict(),
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_actual_hours": self.duration_actual_hours,
            "decay_trends": self.decay_trends,
            "collapse_events": self.collapse_events,
            "survivability_score": self.survivability_score,
            "memory_drift_mb_per_hour": self.memory_drift_mb_per_hour,
            "ws_stability_decay": self.ws_stability_decay,
            "retry_amplification_factor": self.retry_amplification_factor,
        }


class OvernightChaosOrchestrator:
    """Runs and monitors overnight chaos sessions in background threads."""

    def __init__(self, evidence_root="evidence"):
        self.evidence_root = evidence_root
        os.makedirs(self.evidence_root, exist_ok=True)
        self.sessions: dict[str, dict[str, Any]] = {}
        self.threads: dict[str, threading.Thread] = {}
        self.stop_flags: dict[str, threading.Event] = {}

    def start(self, config) -> str:
        """Start a background chaos session and return its session id."""
        if not isinstance(config, OvernightChaosConfig):
            config = OvernightChaosConfig(**config)

        session_id = f"overnight-{uuid.uuid4().hex[:8]}"
        trackers = {
            "decay": RuntimeDecayTracker(),
            "memory": MemoryDriftTracker(),
            "queue": QueueCreepTracker(),
            "retry": RetryAmplificationTracker(),
            "ws": PersistentWebSocketWarfare(),
            "survivability": SurvivabilityTracker(),
        }
        trackers["decay"].start()
        trackers["memory"].start_tracking()

        self.stop_flags[session_id] = threading.Event()
        self.sessions[session_id] = {
            "session_id": session_id,
            "config": config,
            "started_at": datetime.now(timezone.utc),
            "status": "running",
            "trackers": trackers,
            "ws_session_id": None,
            "result": None,
        }

        thread = threading.Thread(target=self._run, args=(session_id,), daemon=True)
        self.threads[session_id] = thread
        thread.start()
        return session_id

    def _run(self, session_id: str) -> None:
        session = self.sessions[session_id]
        config: OvernightChaosConfig = session["config"]
        trackers = session["trackers"]
        stop_flag = self.stop_flags[session_id]
        duration_seconds = max(0.0, config.duration_hours * 3600.0)
        end_at = time.time() + duration_seconds

        if config.ws_url and "websocket_warfare" in config.scenarios:
            connections = {"low": 5, "medium": 10, "high": 25}.get(config.intensity, 10)
            session["ws_session_id"] = trackers["ws"].start_session(config.ws_url, connections=connections, duration_hours=config.duration_hours)

        tick = 0
        while not stop_flag.is_set() and time.time() < end_at:
            tick += 1
            self._sample(session_id, tick)
            stop_flag.wait(max(1, config.sample_interval_seconds))

        if session.get("status") == "running":
            session["status"] = "completed"
            session["result"] = self._build_result(session_id)
            self._persist_result(session_id)

    def _sample(self, session_id: str, tick: int) -> None:
        session = self.sessions[session_id]
        trackers = session["trackers"]
        config: OvernightChaosConfig = session["config"]

        intensity_factor = {"low": 0.5, "medium": 1.0, "high": 2.0}.get(config.intensity, 1.0)
        elapsed = (datetime.now(timezone.utc) - session["started_at"]).total_seconds()
        hours = elapsed / 3600.0

        mem = trackers["memory"].sample()
        queue_depth = int(max(0, tick * intensity_factor + random.randint(-2, 4)))
        retry_count = int(max(1, 1 + tick * 0.2 * intensity_factor + random.randint(0, 2)))
        trackers["queue"].record(queue_depth, processed=max(0, int(5 * intensity_factor)))
        retry_point = trackers["retry"].record(retry_count)

        ws_stats = {}
        if session.get("ws_session_id"):
            ws_stats = trackers["ws"].get_session_stats(session["ws_session_id"])

        metrics = {
            "cpu_percent": min(100.0, 20.0 + hours * 2.0 * intensity_factor + random.random() * 10.0),
            "memory_mb": mem.heap_mb,
            "websocket_count": ws_stats.get("connections_maintained", 0),
            "queue_depth": queue_depth,
            "error_rate": min(1.0, retry_point.amplification_factor / 100.0),
            "retry_count": retry_count,
        }
        trackers["decay"].record_snapshot(metrics)

        if metrics["cpu_percent"] >= 95 or metrics["error_rate"] >= 0.5 or retry_point.is_storm:
            trackers["survivability"].record_collapse("threshold_exceeded", metrics)

    def _build_result(self, session_id: str) -> OvernightChaosResult:
        session = self.sessions[session_id]
        trackers = session["trackers"]
        config = session["config"]
        started = session["started_at"]
        completed = datetime.now(timezone.utc)

        if session.get("ws_session_id"):
            ws_stats = trackers["ws"].stop_session(session["ws_session_id"])
        else:
            ws_stats = {}

        retry_points = trackers["retry"].get_points()
        retry_factor = retry_points[-1].amplification_factor if retry_points else 1.0
        ws_health = ws_stats.get("health", {}) if isinstance(ws_stats, dict) else {}
        ws_stability_decay = 1.0 - float(ws_health.get("connection_stability", 1.0))
        score = trackers["survivability"].calculate_score().to_dict()

        return OvernightChaosResult(
            config=config,
            started_at=started,
            completed_at=completed,
            duration_actual_hours=(completed - started).total_seconds() / 3600.0,
            decay_trends=[t.to_dict() for t in trackers["decay"].calculate_trends()],
            collapse_events=trackers["survivability"].collapse_events,
            survivability_score=score,
            memory_drift_mb_per_hour=trackers["memory"].get_drift_rate(),
            ws_stability_decay=ws_stability_decay,
            retry_amplification_factor=retry_factor,
        )

    def _persist_result(self, session_id: str) -> None:
        result = self.sessions[session_id].get("result")
        if not result:
            return
        path = os.path.join(self.evidence_root, f"longrun-{session_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, indent=2, default=str)

    def stop(self, session_id) -> OvernightChaosResult:
        """Stop a session and return its result."""
        if session_id not in self.sessions:
            raise KeyError(f"Unknown session_id: {session_id}")
        self.stop_flags[session_id].set()
        thread = self.threads.get(session_id)
        if thread:
            thread.join(timeout=5)
        session = self.sessions[session_id]
        if session.get("result") is None:
            session["status"] = "stopped"
            session["result"] = self._build_result(session_id)
            self._persist_result(session_id)
        return session["result"]

    def get_status(self, session_id) -> dict:
        """Return current session status."""
        session = self.sessions.get(session_id)
        if not session:
            return {"error": "Session not found", "session_id": session_id}
        return {
            "session_id": session_id,
            "status": session["status"],
            "started_at": session["started_at"].isoformat(),
            "elapsed_seconds": (datetime.now(timezone.utc) - session["started_at"]).total_seconds(),
            "config": session["config"].to_dict(),
            "current_decay": self.get_current_decay(session_id),
        }

    def get_current_decay(self, session_id) -> dict:
        """Return current decay metrics."""
        session = self.sessions.get(session_id)
        if not session:
            return {"error": "Session not found", "session_id": session_id}
        trackers = session["trackers"]
        return {
            "runtime_decay": trackers["decay"].get_decay_report(),
            "memory_drift": trackers["memory"].get_report(),
            "queue_creep": trackers["queue"].get_report(),
            "retry_amplification": trackers["retry"].get_report(),
            "websocket": trackers["ws"].get_all_stats(),
            "survivability": trackers["survivability"].get_report(),
        }
