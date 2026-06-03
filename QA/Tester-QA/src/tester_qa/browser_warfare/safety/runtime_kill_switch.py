"""Runtime kill switch with persistent audit history."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class RuntimeKillSwitch:
    """Armable kill switch for aborting unsafe runtime operations."""

    def __init__(self, audit_path: str | Path | None = None) -> None:
        self._armed = False
        self._reason = ""
        self._audit_path = Path(audit_path or "audit/runtime_kill_switch.jsonl")
        self._events: list[dict[str, Any]] = []
        self._load_history()

    def arm(self, reason: str) -> dict[str, Any]:
        """Arm the kill switch without triggering shutdown."""
        self._armed = True
        self._reason = reason
        return self._record("armed", reason)

    def disarm(self) -> dict[str, Any]:
        """Disarm the kill switch."""
        previous_reason = self._reason
        self._armed = False
        self._reason = ""
        return self._record("disarmed", previous_reason)

    def is_armed(self) -> bool:
        """Return True when the kill switch is armed."""
        return self._armed

    def trigger(self, reason: str) -> dict[str, Any]:
        """Trigger the kill switch and persist an audit event."""
        self._armed = True
        self._reason = reason
        return self._record("triggered", reason)

    def should_abort(self) -> bool:
        """Return True when callers should abort work immediately."""
        return self._armed

    def history(self) -> list[dict[str, Any]]:
        """Return in-memory and loaded audit history."""
        return list(self._events)

    def _record(self, event_type: str, reason: str) -> dict[str, Any]:
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event_type,
            "reason": reason,
            "armed": self._armed,
        }
        self._events.append(event)
        self._persist(event)
        return event

    def _persist(self, event: dict[str, Any]) -> None:
        self._audit_path.parent.mkdir(parents=True, exist_ok=True)
        with self._audit_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, sort_keys=True) + "\n")

    def _load_history(self) -> None:
        if not self._audit_path.exists():
            return
        with self._audit_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    self._events.append(json.loads(line))
                except json.JSONDecodeError:
                    self._events.append({"event": "corrupt_audit_line", "raw": line})
