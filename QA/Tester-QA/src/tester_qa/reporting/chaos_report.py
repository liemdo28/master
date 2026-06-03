from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ChaosExperiment:
    name: str
    target_system: str
    fault_type: str
    duration_sec: float
    outcome: str
    recovered: bool
    recovery_time_sec: float = 0.0
    impact_description: str = ""
    metrics_during: dict[str, float] = field(default_factory=dict)


@dataclass
class ChaosReportData:
    title: str
    generated_at: float
    experiments: list[ChaosExperiment] = field(default_factory=list)
    resilience_score: float = 0.0
    summary: str = ""
    recommendations: list[str] = field(default_factory=list)
    systems_tested: list[str] = field(default_factory=list)
    total_experiments: int = 0
    passed: int = 0
    failed: int = 0


class ChaosReport:
    """Generates reports from chaos engineering experiments."""

    def __init__(self) -> None:
        self._experiments: list[ChaosExperiment] = []

    def add_experiment(self, experiment: ChaosExperiment) -> None:
        """Add a chaos experiment result."""
        self._experiments.append(experiment)

    def generate_report(
        self,
        title: str = "Chaos Engineering Report",
        experiments: Optional[list[ChaosExperiment]] = None,
    ) -> ChaosReportData:
        """Generate a comprehensive chaos engineering report."""
        if experiments is not None:
            self._experiments = experiments

        resilience_score = self.calculate_resilience_score()
        summary = self.summarize_chaos_results()

        systems_tested = list({exp.target_system for exp in self._experiments})
        passed = sum(1 for exp in self._experiments if exp.recovered)
        failed = len(self._experiments) - passed

        recommendations = self._generate_recommendations()

        return ChaosReportData(
            title=title,
            generated_at=time.time(),
            experiments=list(self._experiments),
            resilience_score=resilience_score,
            summary=summary,
            recommendations=recommendations,
            systems_tested=systems_tested,
            total_experiments=len(self._experiments),
            passed=passed,
            failed=failed,
        )

    def summarize_chaos_results(self) -> str:
        """Generate a human-readable summary of chaos experiment results."""
        if not self._experiments:
            return "No chaos experiments have been conducted."

        total = len(self._experiments)
        recovered = sum(1 for exp in self._experiments if exp.recovered)
        failed = total - recovered

        avg_recovery = 0.0
        recovery_times = [exp.recovery_time_sec for exp in self._experiments if exp.recovered]
        if recovery_times:
            avg_recovery = sum(recovery_times) / len(recovery_times)

        systems = {exp.target_system for exp in self._experiments}
        fault_types = {exp.fault_type for exp in self._experiments}

        parts: list[str] = [
            f"Conducted {total} chaos experiments across {len(systems)} systems.",
            f"Recovery rate: {recovered}/{total} ({(recovered / total) * 100:.1f}%).",
        ]

        if failed > 0:
            parts.append(f"Failed recoveries: {failed}.")

        if avg_recovery > 0:
            parts.append(f"Average recovery time: {avg_recovery:.1f}s.")

        parts.append(f"Fault types tested: {', '.join(sorted(fault_types))}.")

        return " ".join(parts)

    def calculate_resilience_score(self) -> float:
        """Calculate a resilience score (0-100) based on chaos experiment outcomes."""
        if not self._experiments:
            return 0.0

        total = len(self._experiments)
        score = 0.0

        recovery_score = sum(1 for exp in self._experiments if exp.recovered) / total * 50.0
        score += recovery_score

        recovery_times = [exp.recovery_time_sec for exp in self._experiments if exp.recovered]
        if recovery_times:
            avg_recovery = sum(recovery_times) / len(recovery_times)
            if avg_recovery < 5.0:
                time_score = 30.0
            elif avg_recovery < 15.0:
                time_score = 20.0
            elif avg_recovery < 60.0:
                time_score = 10.0
            else:
                time_score = 5.0
            score += time_score

        systems_tested = len({exp.target_system for exp in self._experiments})
        coverage_score = min(20.0, systems_tested * 5.0)
        score += coverage_score

        return max(0.0, min(100.0, score))

    def _generate_recommendations(self) -> list[str]:
        """Generate recommendations based on chaos results."""
        recommendations: list[str] = []

        failed_experiments = [exp for exp in self._experiments if not exp.recovered]
        if failed_experiments:
            affected_systems = {exp.target_system for exp in failed_experiments}
            recommendations.append(
                f"Critical: Systems that failed to recover: {', '.join(sorted(affected_systems))}. "
                "Implement circuit breakers and fallback mechanisms."
            )

        slow_recoveries = [
            exp for exp in self._experiments
            if exp.recovered and exp.recovery_time_sec > 30.0
        ]
        if slow_recoveries:
            recommendations.append(
                "Improve recovery time for slow-recovering systems. "
                "Consider implementing health checks and auto-restart policies."
            )

        if len(self._experiments) < 5:
            recommendations.append(
                "Expand chaos testing coverage. More experiments needed for confidence."
            )

        if not recommendations:
            recommendations.append("System resilience is strong. Continue regular chaos testing.")

        return recommendations
