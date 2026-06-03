"""WebSocket anomaly pattern analysis."""
from __future__ import annotations

from collections import Counter, defaultdict
from statistics import mean, pstdev


class WebSocketAnomalyDetector:
    """Detects WebSocket spikes, desync recurrence, and reconnect amplification."""

    def detect_anomalies(self, ws_history: list[dict]) -> list[dict]:
        """Find spikes in reconnect_count and message_rate using z-score/thresholds."""
        if not ws_history:
            return []
        reconnects = [float(x.get("reconnect_count", 0) or 0) for x in ws_history]
        rates = [float(x.get("message_rate", 0) or 0) for x in ws_history]
        rc_mean, rc_sd = mean(reconnects), pstdev(reconnects) if len(reconnects) > 1 else 0
        rate_mean, rate_sd = mean(rates), pstdev(rates) if len(rates) > 1 else 0
        anomalies = []
        for item in ws_history:
            rc = float(item.get("reconnect_count", 0) or 0)
            rate = float(item.get("message_rate", 0) or 0)
            reasons = []
            if (rc_sd and (rc - rc_mean) / rc_sd >= 2) or (rc_mean > 0 and rc >= rc_mean * 3):
                reasons.append("reconnect_spike")
            if (rate_sd and (rate - rate_mean) / rate_sd >= 2) or (rate_mean > 0 and rate >= rate_mean * 3):
                reasons.append("message_rate_spike")
            if reasons:
                anomalies.append({"timestamp": item.get("timestamp"), "reasons": reasons, "reconnect_count": rc, "message_rate": rate})
        return anomalies

    def find_desync_patterns(self, ws_history: list[dict]) -> list[dict]:
        """Find recurring desync events grouped by channel/session/failure mode."""
        groups = defaultdict(list)
        for item in ws_history:
            if item.get("desync_detected") or item.get("failure_mode") == "desync":
                key = item.get("channel") or item.get("session_id") or item.get("endpoint") or "global"
                groups[str(key)].append(item)
        patterns = []
        for key, events in groups.items():
            modes = Counter(str(e.get("failure_mode", "desync")) for e in events)
            patterns.append({"scope": key, "count": len(events), "first_seen": min(str(e.get("timestamp", "")) for e in events), "last_seen": max(str(e.get("timestamp", "")) for e in events), "modes": dict(modes)})
        return sorted(patterns, key=lambda x: x["count"], reverse=True)

    def detect_reconnect_amplification(self, ws_history: list[dict]) -> dict:
        """Detect reconnect amplification where reconnects accelerate over time."""
        if len(ws_history) < 3:
            return {"detected": False, "amplification_factor": 0.0, "onset_time": None}
        ordered = sorted(ws_history, key=lambda x: str(x.get("timestamp", "")))
        counts = [float(x.get("reconnect_count", 0) or 0) for x in ordered]
        baseline = mean(counts[:max(1, len(counts)//3)])
        recent = mean(counts[-max(1, len(counts)//3):])
        factor = recent / baseline if baseline > 0 else (recent if recent > 0 else 0.0)
        detected = factor >= 2.0 and recent >= 3
        onset = None
        threshold = baseline * 2 if baseline > 0 else 3
        for item, count in zip(ordered, counts):
            if count >= threshold:
                onset = item.get("timestamp")
                break
        return {"detected": detected, "amplification_factor": round(factor, 3), "onset_time": onset}
