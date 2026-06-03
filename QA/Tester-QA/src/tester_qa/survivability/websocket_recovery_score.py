"""WebSocket recovery and resynchronization scoring."""

from __future__ import annotations

from typing import Any, Iterable, Mapping


class WebSocketRecoveryScorer:
    """Score reconnect, replay, and resync behavior for WebSocket channels."""

    def score(self, metrics: Mapping[str, Any]) -> dict[str, Any]:
        metric = dict(metrics or {})
        reconnect_rate = self._ratio(metric, "reconnect_success_rate", 1.0)
        resync_rate = self._ratio(metric, "resync_success_rate", 1.0)
        message_loss_rate = self._ratio(metric, "message_loss_rate", 0.0)
        duplicate_rate = self._ratio(metric, "duplicate_message_rate", 0.0)
        reconnect_ms = self._number(metric, "avg_reconnect_ms", self._number(metric, "reconnect_ms", 0.0))
        max_reconnect_ms = self._number(metric, "max_reconnect_ms", reconnect_ms)
        disconnects = self._number(metric, "disconnect_count", 0.0)
        reconnect_score = reconnect_rate - min(0.18, reconnect_ms / 30000.0) - min(0.07, disconnects * 0.005)
        resync_score = resync_rate - min(0.25, message_loss_rate * 1.4) - min(0.14, duplicate_rate * 0.9)
        latency_score = 1.0 - min(0.25, max_reconnect_ms / 60000.0)
        overall = self._clamp(reconnect_score * 0.4 + resync_score * 0.45 + latency_score * 0.15)
        issues = []
        if reconnect_rate < 0.95:
            issues.append("reconnect_success_below_target")
        if resync_rate < 0.98:
            issues.append("resync_success_below_target")
        if message_loss_rate > 0.0:
            issues.append("message_loss_detected")
        if duplicate_rate > 0.01:
            issues.append("duplicate_messages_detected")
        return {"score": round(overall, 4), "reconnect_score": round(self._clamp(reconnect_score), 4), "resync_score": round(self._clamp(resync_score), 4), "latency_score": round(self._clamp(latency_score), 4), "issues": issues, "status": self._status(overall)}

    def validate_resync(self, history: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
        events = [dict(item) for item in (history or []) if isinstance(item, Mapping)]
        if not events:
            return {"valid": True, "score": 1.0, "gaps": [], "duplicates": 0, "out_of_order": 0, "events_checked": 0}
        gaps: list[str] = []
        duplicates = 0
        out_of_order = 0
        previous_seq: int | None = None
        seen: set[int] = set()
        for event in events:
            seq_raw = event.get("sequence") or event.get("seq") or event.get("message_id")
            try:
                seq = int(seq_raw)
            except (TypeError, ValueError):
                continue
            if seq in seen:
                duplicates += 1
            if previous_seq is not None:
                if seq < previous_seq:
                    out_of_order += 1
                elif seq > previous_seq + 1:
                    gaps.append(f"missing_{previous_seq + 1}_to_{seq - 1}")
            seen.add(seq)
            previous_seq = seq
        explicit_failures = sum(1 for event in events if event.get("resync") is False or event.get("resynced") is False)
        score = self._clamp(1.0 - min(0.35, len(gaps) * 0.08) - min(0.20, duplicates * 0.03) - min(0.20, out_of_order * 0.04) - min(0.25, explicit_failures * 0.08))
        return {"valid": score >= 0.85 and not gaps, "score": round(score, 4), "gaps": gaps, "duplicates": duplicates, "out_of_order": out_of_order, "events_checked": len(events)}

    @staticmethod
    def _number(metrics: Mapping[str, Any], key: str, default: float) -> float:
        try:
            value = metrics.get(key, default)
            return default if value is None else float(value)
        except (TypeError, ValueError):
            return default

    @classmethod
    def _ratio(cls, metrics: Mapping[str, Any], key: str, default: float) -> float:
        value = cls._number(metrics, key, default)
        if 1.0 < value <= 100.0:
            value /= 100.0
        return cls._clamp(value)

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    @staticmethod
    def _status(score: float) -> str:
        if score >= 0.9:
            return "resilient"
        if score >= 0.75:
            return "recoverable"
        if score >= 0.55:
            return "degraded"
        return "unsafe"
