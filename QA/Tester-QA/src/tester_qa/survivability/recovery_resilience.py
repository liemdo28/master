"""Recovery integrity and residual corruption scoring."""

from __future__ import annotations

from typing import Any, Iterable, Mapping


class RecoveryResilienceValidator:
    """Validate whether recovery completed cleanly and restored integrity."""

    def validate(self, recovery_history: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
        events = [dict(event) for event in (recovery_history or []) if isinstance(event, Mapping)]
        integrity = self.score_recovery_integrity(events)
        corruption = self.detect_residual_corruption(events)
        attempts = len(events)
        successful = sum(1 for event in events if self._is_success(event))
        avg_recovery_seconds = self._average(self._number(event, "recovery_time_seconds", self._number(event, "duration_seconds", 0.0)) for event in events)
        rollback_count = sum(1 for event in events if bool(event.get("rollback") or event.get("rolled_back")))
        score = integrity - (min(0.30, len(corruption) * 0.075) if corruption else 0.0)
        if attempts and successful / attempts < 0.8:
            score -= 0.12
        score = self._clamp(score)
        return {"score": round(score, 4), "integrity_score": round(integrity, 4), "attempts": attempts, "successful_recoveries": successful, "success_rate": round(successful / attempts, 4) if attempts else 1.0, "avg_recovery_seconds": round(avg_recovery_seconds, 4), "rollback_count": rollback_count, "residual_corruption": corruption, "status": self._status(score, corruption)}

    def score_recovery_integrity(self, events: Iterable[Mapping[str, Any]]) -> float:
        event_list = [dict(event) for event in (events or []) if isinstance(event, Mapping)]
        if not event_list:
            return 1.0
        score = 1.0 - min(0.35, sum(1 for event in event_list if not self._is_success(event)) / len(event_list) * 0.5)
        for event in event_list:
            if bool(event.get("data_loss") or event.get("lost_messages")):
                score -= 0.12
            if bool(event.get("state_mismatch") or event.get("checksum_mismatch")):
                score -= 0.10
            if bool(event.get("manual_intervention_required") or event.get("manual_intervention")):
                score -= 0.08
            recovery_time = self._number(event, "recovery_time_seconds", self._number(event, "duration_seconds", 0.0))
            target_time = max(1.0, self._number(event, "target_recovery_seconds", 60.0))
            if recovery_time > target_time:
                score -= min(0.08, (recovery_time - target_time) / target_time * 0.04)
        return self._clamp(score)

    def detect_residual_corruption(self, events: Iterable[Mapping[str, Any]]) -> list[str]:
        findings: set[str] = set()
        for event in events or []:
            if not isinstance(event, Mapping):
                continue
            checks = (("data_loss_after_recovery", ("data_loss", "lost_messages")), ("stale_state_residue", ("stale_state", "stale_cache")), ("duplicate_event_residue", ("duplicate_events", "duplicate_messages")), ("orphaned_work_residue", ("orphaned_jobs", "orphaned_tasks")), ("state_integrity_mismatch", ("state_mismatch", "checksum_mismatch")))
            for finding, keys in checks:
                if any(bool(event.get(key)) for key in keys):
                    findings.add(finding)
            custom = event.get("corruption") or event.get("residual_corruption")
            if isinstance(custom, str) and custom.strip():
                findings.add(custom.strip().lower().replace(" ", "_"))
            elif isinstance(custom, Iterable) and not isinstance(custom, (str, bytes, Mapping)):
                findings.update(str(item).strip().lower().replace(" ", "_") for item in custom if item)
        return sorted(findings)

    @staticmethod
    def _is_success(event: Mapping[str, Any]) -> bool:
        status = str(event.get("status", "")).lower()
        if status in {"success", "succeeded", "recovered", "healthy", "ok"}:
            return True
        if status in {"failed", "failure", "timeout", "degraded", "corrupt"}:
            return False
        return bool(event.get("success", event.get("recovered", True)))

    @staticmethod
    def _number(event: Mapping[str, Any], key: str, default: float) -> float:
        try:
            value = event.get(key, default)
            return default if value is None else float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _average(values: Iterable[float]) -> float:
        nums = [value for value in values if value > 0]
        return sum(nums) / len(nums) if nums else 0.0

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    @staticmethod
    def _status(score: float, corruption: list[str]) -> str:
        if corruption or score < 0.55:
            return "unsafe"
        if score < 0.75:
            return "degraded"
        if score < 0.9:
            return "recoverable"
        return "resilient"
