"""Collapse Coordinator — End-to-end collapse simulation with forensic output.

Orchestrates multi-phase collapse scenarios and produces:
- Collapse Trigger
- Collapse Timing
- Weakest Subsystem
- Recovery Probability
- Blast Radius
- Failure Amplification Chain
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class CollapsePhase(str, Enum):
    INJECTION = "injection"
    PROPAGATION = "propagation"
    AMPLIFICATION = "amplification"
    SATURATION = "saturation"
    COLLAPSE = "collapse"
    RECOVERY_ATTEMPT = "recovery_attempt"


@dataclass
class CollapseEvent:
    timestamp: float
    phase: CollapsePhase
    subsystem: str
    description: str
    severity: float  # 0-1
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "phase": self.phase.value,
            "subsystem": self.subsystem,
            "description": self.description,
            "severity": round(self.severity, 4),
            "metrics": self.metrics,
        }


@dataclass
class CollapseResult:
    """Complete collapse simulation result with forensic output."""
    scenario_id: str
    collapse_trigger: str
    collapse_timing_ms: float
    weakest_subsystem: str
    recovery_probability: float
    blast_radius_score: float
    failure_amplification_chain: list[str]
    events: list[CollapseEvent] = field(default_factory=list)
    affected_subsystems: list[str] = field(default_factory=list)
    cascade_depth: int = 0
    total_duration_ms: float = 0.0
    peak_severity: float = 0.0
    recovery_attempted: bool = False
    recovery_successful: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "collapse_trigger": self.collapse_trigger,
            "collapse_timing_ms": round(self.collapse_timing_ms, 2),
            "weakest_subsystem": self.weakest_subsystem,
            "recovery_probability": round(self.recovery_probability, 4),
            "blast_radius_score": round(self.blast_radius_score, 4),
            "failure_amplification_chain": self.failure_amplification_chain,
            "affected_subsystems": self.affected_subsystems,
            "cascade_depth": self.cascade_depth,
            "total_duration_ms": round(self.total_duration_ms, 2),
            "peak_severity": round(self.peak_severity, 4),
            "recovery_attempted": self.recovery_attempted,
            "recovery_successful": self.recovery_successful,
            "event_count": len(self.events),
            "timeline": [e.to_dict() for e in self.events],
        }

    def to_forensic_timeline(self) -> str:
        """Generate forensic timeline output."""
        lines = [
            f"# Collapse Forensic Timeline: {self.scenario_id}",
            f"Trigger: {self.collapse_trigger}",
            f"Duration: {self.total_duration_ms:.0f}ms",
            f"Weakest: {self.weakest_subsystem}",
            f"Blast Radius: {self.blast_radius_score:.2f}",
            "",
        ]
        base_time = self.events[0].timestamp if self.events else 0
        for event in self.events:
            offset_ms = (event.timestamp - base_time) * 1000
            lines.append(
                f"  +{offset_ms:>8.0f}ms [{event.phase.value:>16}] "
                f"{event.subsystem}: {event.description} (severity={event.severity:.2f})"
            )
        lines.append("")
        lines.append("Failure Chain:")
        for i, step in enumerate(self.failure_amplification_chain, 1):
            lines.append(f"  {i}. {step}")
        return "\n".join(lines)


@dataclass
class SubsystemState:
    name: str
    health: float = 1.0  # 0=dead, 1=healthy
    load: float = 0.0
    error_rate: float = 0.0
    dependencies: list[str] = field(default_factory=list)
    failure_threshold: float = 0.8

    def is_failed(self) -> bool:
        return self.health <= 0.0 or self.load >= self.failure_threshold


class CollapseCoordinator:
    """Orchestrates multi-phase collapse simulations."""

    def __init__(self) -> None:
        self._subsystems: dict[str, SubsystemState] = {}
        self._results: list[CollapseResult] = []
        self._scenario_counter = 0

    def register_subsystem(
        self,
        name: str,
        dependencies: Optional[list[str]] = None,
        failure_threshold: float = 0.8,
    ) -> None:
        """Register a subsystem for collapse simulation."""
        self._subsystems[name] = SubsystemState(
            name=name,
            dependencies=dependencies or [],
            failure_threshold=failure_threshold,
        )

    def register_default_topology(self) -> None:
        """Register a typical web application topology."""
        self.register_subsystem("api_gateway", dependencies=["auth", "provider", "queue"])
        self.register_subsystem("auth", dependencies=["database", "cache"])
        self.register_subsystem("provider", dependencies=["network"])
        self.register_subsystem("queue", dependencies=["database"])
        self.register_subsystem("websocket", dependencies=["auth", "queue"])
        self.register_subsystem("database", dependencies=[])
        self.register_subsystem("cache", dependencies=[])
        self.register_subsystem("network", dependencies=[])
        self.register_subsystem("browser", dependencies=["websocket", "api_gateway"])
        self.register_subsystem("event_loop", dependencies=["queue", "websocket"])

    def simulate_collapse(
        self,
        trigger_subsystem: str,
        trigger_description: str = "Injected failure",
        intensity: float = 0.8,
        propagation_speed: float = 1.0,
    ) -> CollapseResult:
        """Simulate a full collapse starting from a trigger subsystem."""
        self._scenario_counter += 1
        scenario_id = f"COLLAPSE-{self._scenario_counter:04d}"

        if not self._subsystems:
            self.register_default_topology()

        # Reset all subsystems
        for ss in self._subsystems.values():
            ss.health = 1.0
            ss.load = 0.0
            ss.error_rate = 0.0

        events: list[CollapseEvent] = []
        chain: list[str] = []
        start_time = time.time()

        # Phase 1: Injection
        if trigger_subsystem in self._subsystems:
            ss = self._subsystems[trigger_subsystem]
            ss.health -= intensity * 0.6
            ss.load += intensity * 0.7
            ss.error_rate = intensity * 0.5
            events.append(CollapseEvent(
                timestamp=time.time(),
                phase=CollapsePhase.INJECTION,
                subsystem=trigger_subsystem,
                description=trigger_description,
                severity=intensity,
                metrics={"health": ss.health, "load": ss.load},
            ))
            chain.append(f"{trigger_subsystem}: {trigger_description}")

        # Phase 2: Propagation — cascade through dependencies
        affected = {trigger_subsystem}
        propagation_rounds = 0
        max_rounds = 5

        while propagation_rounds < max_rounds:
            propagation_rounds += 1
            new_affected = set()

            for name, ss in self._subsystems.items():
                if name in affected:
                    continue
                # Check if any dependency is failing
                dep_damage = 0.0
                for dep in ss.dependencies:
                    if dep in affected:
                        dep_ss = self._subsystems.get(dep)
                        if dep_ss:
                            dep_damage += (1.0 - dep_ss.health) * propagation_speed * 0.4

                if dep_damage > 0.1:
                    ss.health -= dep_damage
                    ss.load += dep_damage * 0.5
                    ss.error_rate += dep_damage * 0.3
                    new_affected.add(name)

                    phase = CollapsePhase.PROPAGATION if propagation_rounds <= 2 else CollapsePhase.AMPLIFICATION
                    events.append(CollapseEvent(
                        timestamp=time.time(),
                        phase=phase,
                        subsystem=name,
                        description=f"Cascade from {', '.join(d for d in ss.dependencies if d in affected)}",
                        severity=dep_damage,
                        metrics={"health": ss.health, "load": ss.load, "error_rate": ss.error_rate},
                    ))
                    chain.append(f"{name}: cascade damage {dep_damage:.2f} from dependencies")

            if not new_affected:
                break
            affected.update(new_affected)

        # Phase 3: Saturation check
        saturated = [name for name, ss in self._subsystems.items() if ss.is_failed()]
        if saturated:
            events.append(CollapseEvent(
                timestamp=time.time(),
                phase=CollapsePhase.SATURATION,
                subsystem="system",
                description=f"Subsystems saturated: {', '.join(saturated)}",
                severity=len(saturated) / max(len(self._subsystems), 1),
                metrics={"saturated_count": len(saturated)},
            ))

        # Phase 4: Collapse determination
        total_health = sum(ss.health for ss in self._subsystems.values())
        avg_health = total_health / max(len(self._subsystems), 1)
        collapsed = avg_health < 0.4

        if collapsed:
            events.append(CollapseEvent(
                timestamp=time.time(),
                phase=CollapsePhase.COLLAPSE,
                subsystem="system",
                description=f"System collapse — avg health {avg_health:.2f}",
                severity=1.0 - avg_health,
                metrics={"avg_health": avg_health, "failed_subsystems": len(saturated)},
            ))
            chain.append(f"SYSTEM COLLAPSE: avg_health={avg_health:.2f}")

        # Calculate results
        end_time = time.time()
        weakest = min(self._subsystems.values(), key=lambda s: s.health)
        blast_radius = len(affected) / max(len(self._subsystems), 1)
        recovery_prob = avg_health * (1 - blast_radius) * 0.8
        peak_severity = max((e.severity for e in events), default=0)

        result = CollapseResult(
            scenario_id=scenario_id,
            collapse_trigger=f"{trigger_subsystem}: {trigger_description}",
            collapse_timing_ms=(end_time - start_time) * 1000,
            weakest_subsystem=weakest.name,
            recovery_probability=max(0, min(1, recovery_prob)),
            blast_radius_score=blast_radius,
            failure_amplification_chain=chain,
            events=events,
            affected_subsystems=list(affected),
            cascade_depth=propagation_rounds,
            total_duration_ms=(end_time - start_time) * 1000,
            peak_severity=peak_severity,
            recovery_attempted=False,
            recovery_successful=False,
        )

        self._results.append(result)
        return result

    def simulate_provider_meltdown(self) -> CollapseResult:
        """Simulate provider timeout storm → cascade."""
        return self.simulate_collapse("provider", "Timeout storm — all requests timing out", intensity=0.9)

    def simulate_websocket_apocalypse(self) -> CollapseResult:
        """Simulate websocket extinction event."""
        return self.simulate_collapse("websocket", "Mass disconnection + reconnect storm", intensity=0.85)

    def simulate_queue_flood(self) -> CollapseResult:
        """Simulate queue overflow → consumer starvation."""
        return self.simulate_collapse("queue", "Queue depth exceeded — consumer starvation", intensity=0.75)

    def simulate_database_failure(self) -> CollapseResult:
        """Simulate database connection pool exhaustion."""
        return self.simulate_collapse("database", "Connection pool exhausted — all queries failing", intensity=0.95)

    def simulate_total_chaos(self) -> list[CollapseResult]:
        """Run all collapse scenarios and return results."""
        return [
            self.simulate_provider_meltdown(),
            self.simulate_websocket_apocalypse(),
            self.simulate_queue_flood(),
            self.simulate_database_failure(),
        ]

    def get_results(self) -> list[CollapseResult]:
        return list(self._results)

    def get_worst_scenario(self) -> Optional[CollapseResult]:
        if not self._results:
            return None
        return max(self._results, key=lambda r: r.blast_radius_score)

    def get_collapse_summary(self) -> dict[str, Any]:
        """Generate executive collapse summary."""
        if not self._results:
            return {"status": "no_scenarios_run", "scenarios": 0}

        worst = self.get_worst_scenario()
        return {
            "scenarios_run": len(self._results),
            "worst_scenario": worst.scenario_id if worst else None,
            "worst_blast_radius": worst.blast_radius_score if worst else 0,
            "worst_weakest_subsystem": worst.weakest_subsystem if worst else None,
            "avg_recovery_probability": sum(r.recovery_probability for r in self._results) / len(self._results),
            "total_collapse_events": sum(len(r.events) for r in self._results),
            "subsystems_ever_failed": list(set(
                ss for r in self._results for ss in r.affected_subsystems
            )),
        }
