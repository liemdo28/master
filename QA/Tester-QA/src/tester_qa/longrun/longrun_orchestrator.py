"""Long-Run Orchestrator — high-level interface for long-run warfare."""
from datetime import datetime, timezone
from typing import Any
import os

from .overnight_chaos import OvernightChaosOrchestrator, OvernightChaosConfig


class LongRunOrchestrator:
    """Convenience orchestrator for 1-hour, 6-hour, overnight, and continuous runs."""

    def __init__(self, evidence_root="evidence"):
        self.evidence_root = evidence_root
        os.makedirs(self.evidence_root, exist_ok=True)
        self.overnight = OvernightChaosOrchestrator(evidence_root=evidence_root)
        self.sessions: dict[str, dict[str, Any]] = {}

    def _start_and_maybe_wait(self, config: OvernightChaosConfig, wait: bool = False) -> dict:
        session_id = self.overnight.start(config)
        self.sessions[session_id] = {
            "type": "longrun",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "config": config.to_dict(),
        }
        if wait:
            result = self.overnight.stop(session_id)
            return result.to_dict()
        return {"session_id": session_id, "status": "running", "config": config.to_dict()}

    def run_1hour(self, target_url, **kwargs) -> dict:
        """Start a 1-hour long-run warfare session."""
        config = OvernightChaosConfig(
            target_url=target_url,
            duration_hours=1.0,
            ws_url=kwargs.get("ws_url"),
            intensity=kwargs.get("intensity", "medium"),
            scenarios=kwargs.get("scenarios", ["runtime_decay", "memory_drift", "queue_creep", "retry_amplification", "websocket_warfare"]),
            sample_interval_seconds=kwargs.get("sample_interval_seconds", 60),
        )
        return self._start_and_maybe_wait(config, wait=kwargs.get("wait", False))

    def run_6hour(self, target_url, **kwargs) -> dict:
        """Start a 6-hour long-run warfare session."""
        config = OvernightChaosConfig(
            target_url=target_url,
            duration_hours=6.0,
            ws_url=kwargs.get("ws_url"),
            intensity=kwargs.get("intensity", "medium"),
            scenarios=kwargs.get("scenarios", ["runtime_decay", "memory_drift", "queue_creep", "retry_amplification", "websocket_warfare"]),
            sample_interval_seconds=kwargs.get("sample_interval_seconds", 60),
        )
        return self._start_and_maybe_wait(config, wait=kwargs.get("wait", False))

    def run_overnight(self, target_url, **kwargs) -> dict:
        """Start an overnight (default 8-hour) long-run warfare session."""
        config = OvernightChaosConfig(
            target_url=target_url,
            duration_hours=kwargs.get("duration_hours", 8.0),
            ws_url=kwargs.get("ws_url"),
            intensity=kwargs.get("intensity", "medium"),
            scenarios=kwargs.get("scenarios", ["runtime_decay", "memory_drift", "queue_creep", "retry_amplification", "websocket_warfare"]),
            sample_interval_seconds=kwargs.get("sample_interval_seconds", 60),
        )
        return self._start_and_maybe_wait(config, wait=kwargs.get("wait", False))

    def run_continuous(self, target_url, **kwargs) -> str:
        """Start a continuous long-run session; returns session_id."""
        config = OvernightChaosConfig(
            target_url=target_url,
            duration_hours=kwargs.get("duration_hours", 24.0 * 365.0),
            ws_url=kwargs.get("ws_url"),
            intensity=kwargs.get("intensity", "low"),
            scenarios=kwargs.get("scenarios", ["runtime_decay", "memory_drift", "queue_creep", "retry_amplification", "websocket_warfare"]),
            sample_interval_seconds=kwargs.get("sample_interval_seconds", 300),
        )
        session_id = self.overnight.start(config)
        self.sessions[session_id] = {
            "type": "continuous",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "config": config.to_dict(),
        }
        return session_id

    def stop(self, session_id) -> dict:
        """Stop a running session and return final result."""
        result = self.overnight.stop(session_id)
        return result.to_dict()

    def get_status(self, session_id) -> dict:
        """Get current status for a session."""
        return self.overnight.get_status(session_id)

    def export_decay_report(self, session_id) -> dict:
        """Export current decay report for a session."""
        status = self.overnight.get_status(session_id)
        if "error" in status:
            return status
        return {
            "session_id": session_id,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "status": status.get("status"),
            "decay": self.overnight.get_current_decay(session_id),
        }
