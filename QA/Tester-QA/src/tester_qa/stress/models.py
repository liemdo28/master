from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class StressResult:
    target: str
    scenario: str
    total: int
    success: int
    failed: int
    duration_ms: int
    latencies_ms: list[int] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def p95_ms(self) -> int:
        if not self.latencies_ms:
            return 0
        ordered = sorted(self.latencies_ms)
        index = min(len(ordered) - 1, int(len(ordered) * 0.95))
        return ordered[index]

    def to_dict(self) -> dict:
        return {
            "target": self.target,
            "scenario": self.scenario,
            "total": self.total,
            "success": self.success,
            "failed": self.failed,
            "duration_ms": self.duration_ms,
            "p95_ms": self.p95_ms,
            "latencies_ms": self.latencies_ms,
            "errors": self.errors,
        }
