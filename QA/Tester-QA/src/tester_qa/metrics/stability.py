from __future__ import annotations


def stability_score(total: int, failed: int, p95_ms: int, latency_budget_ms: int = 1000) -> int:
    if total <= 0:
        return 0
    failure_penalty = (failed / total) * 70
    latency_penalty = min(30, (p95_ms / max(1, latency_budget_ms)) * 30)
    return max(0, min(100, int(100 - failure_penalty - latency_penalty)))
