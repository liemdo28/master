"""Recovery Validation Engine — Tester-QA

Validates system survival under collapse conditions:
- WebSocket reconnection safety
- Queue recovery integrity
- Retry logic catastrophe detection
- Stale state post-reconnect
- Repeated failure resilience
"""
from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional


class CollapseType(str, Enum):
    PROVIDER_OUTAGE = "provider_outage"
    WEBSOCKET_EXTINCTION = "websocket_extinction"
    QUEUE_OVERFLOW = "queue_overflow"
    MEMORY_EXHAUSTION = "memory_exhaustion"
    NETWORK_PARTITION = "network_partition"
    CASCADING_FAILURE = "cascading_failure"


class RecoveryStatus(str, Enum):
    RECOVERED = "RECOVERED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    STALE = "STALE"
    CATESTROPHIC = "CATASTROPHIC"


@dataclass
class RecoveryMetrics:
    recovery_time_ms: float = 0.0
    recovery_stability_score: float = 0.0
    residual_corruption_pct: float = 0.0
    post_recovery_integrity: float = 0.0
    repeated_failure_risk: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "recovery_time_ms": round(self.recovery_time_ms, 2),
            "recovery_stability_score": round(self.recovery_stability_score, 4),
            "residual_corruption_pct": round(self.residual_corruption_pct, 4),
            "post_recovery_integrity": round(self.post_recovery_integrity, 4),
            "repeated_failure_risk": round(self.repeated_failure_risk, 4),
        }


@dataclass
class CollapseScenario:
    collapse_type: CollapseType
    duration_ms: float
    intensity: float
    affected_components: list[str] = field(default_factory=list)
    trigger_condition: str = ""
    injection_timestamp: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "collapse_type": self.collapse_type.value,
            "duration_ms": self.duration_ms,
            "intensity": self.intensity,
            "affected_components": self.affected_components,
            "trigger_condition": self.trigger_condition,
            "injection_timestamp": self.injection_timestamp.isoformat() if self.injection_timestamp else None,
        }


@dataclass
class WebSocketRecoveryResult:
    connection_reestablished: bool = False
    recovery_time_ms: float = 0.0
    message_loss_count: int = 0
    sequence_gaps: int = 0
    reconnection_storm_triggered: bool = False
    stale_state_after_reconnect: bool = False
    desync_detected: bool = False
    recovery_status: RecoveryStatus = RecoveryStatus.FAILED

    def to_dict(self) -> dict[str, Any]:
        return {
            "connection_reestablished": self.connection_reestablished,
            "recovery_time_ms": round(self.recovery_time_ms, 2),
            "message_loss_count": self.message_loss_count,
            "sequence_gaps": self.sequence_gaps,
            "reconnection_storm_triggered": self.reconnection_storm_triggered,
            "stale_state_after_reconnect": self.stale_state_after_reconnect,
            "desync_detected": self.desync_detected,
            "recovery_status": self.recovery_status.value,
        }


@dataclass
class QueueRecoveryResult:
    queue_drained: bool = False
    recovery_time_ms: float = 0.0
    message_loss_count: int = 0
    dead_letter_queue_size: int = 0
    consumer_restored: bool = False
    backlog_remaining_pct: float = 0.0
    recovery_status: RecoveryStatus = RecoveryStatus.FAILED

    def to_dict(self) -> dict[str, Any]:
        return {
            "queue_drained": self.queue_drained,
            "recovery_time_ms": round(self.recovery_time_ms, 2),
            "message_loss_count": self.message_loss_count,
            "dead_letter_queue_size": self.dead_letter_queue_size,
            "consumer_restored": self.consumer_restored,
            "backlog_remaining_pct": round(self.backlog_remaining_pct, 4),
            "recovery_status": self.recovery_status.value,
        }


@dataclass
class RetryCatastropheResult:
    catastrophic: bool = False
    retry_amplification_factor: float = 0.0
    exponential_backoff_broken: bool = False
    thundering_herd_triggered: bool = False
    total_retry_attempts: int = 0
    timeout_chain_generated: bool = False
    max_retry_depth: int = 0
    recovery_status: RecoveryStatus = RecoveryStatus.FAILED

    def to_dict(self) -> dict[str, Any]:
        return {
            "catastrophic": self.catastrophic,
            "retry_amplification_factor": round(self.retry_amplification_factor, 4),
            "exponential_backoff_broken": self.exponential_backoff_broken,
            "thundering_herd_triggered": self.thundering_herd_triggered,
            "total_retry_attempts": self.total_retry_attempts,
            "timeout_chain_generated": self.timeout_chain_generated,
            "max_retry_depth": self.max_retry_depth,
            "recovery_status": self.recovery_status.value,
        }


@dataclass
class StaleStateResult:
    stale_state_detected: bool = False
    stale_duration_sec: float = 0.0
    stale_data_age_sec: float = 0.0
    zombie_ui_elements: int = 0
    memory_corruption_detected: bool = False
    cache_poisoning_detected: bool = False
    recovery_status: RecoveryStatus = RecoveryStatus.FAILED

    def to_dict(self) -> dict[str, Any]:
        return {
            "stale_state_detected": self.stale_state_detected,
            "stale_duration_sec": round(self.stale_duration_sec, 2),
            "stale_data_age_sec": round(self.stale_data_age_sec, 2),
            "zombie_ui_elements": self.zombie_ui_elements,
            "memory_corruption_detected": self.memory_corruption_detected,
            "cache_poisoning_detected": self.cache_poisoning_detected,
            "recovery_status": self.recovery_status.value,
        }


class RecoveryValidator:
    """Validates system survival and recovery under collapse conditions."""

    def __init__(self) -> None:
        self._scenarios_run: list[CollapseScenario] = []
        self._results: list[dict[str, Any]] = []

    def validate_websocket_recovery(
        self,
        scenario: CollapseScenario,
        message_loss_rate: float = 0.1,
        reconnection_overhead: float = 0.3,
    ) -> WebSocketRecoveryResult:
        """Simulate websocket recovery after collapse."""
        scenario.injection_timestamp = datetime.now(timezone.utc)
        recovery_time = (scenario.duration_ms / 1000) * (1 + reconnection_overhead)
        recovery_time_ms = min(recovery_time, scenario.duration_ms * 2)

        reconnection_storm = scenario.intensity > 0.7 and scenario.duration_ms > 5000
        stale_state = scenario.intensity > 0.5 and random.random() < scenario.intensity * 0.4
        desync = scenario.intensity > 0.6 and random.random() < scenario.intensity * 0.3

        message_loss = int(message_loss_rate * 100)
        sequence_gaps = int(desync * 10) if desync else 0

        status = RecoveryStatus.FAILED
        if scenario.intensity < 0.3:
            status = RecoveryStatus.RECOVERED
        elif scenario.intensity < 0.6:
            status = RecoveryStatus.PARTIAL if not desync else RecoveryStatus.STALE
        elif scenario.intensity > 0.8:
            status = RecoveryStatus.CATASTROPHIC

        return WebSocketRecoveryResult(
            connection_reestablished=scenario.intensity < 0.95,
            recovery_time_ms=recovery_time_ms,
            message_loss_count=message_loss,
            sequence_gaps=sequence_gaps,
            reconnection_storm_triggered=reconnection_storm,
            stale_state_after_reconnect=stale_state,
            desync_detected=desync,
            recovery_status=status,
        )

    def validate_queue_recovery(
        self,
        scenario: CollapseScenario,
        queue_depth: int = 1000,
        consumer_health: float = 0.8,
    ) -> QueueRecoveryResult:
        """Simulate queue recovery after collapse."""
        scenario.injection_timestamp = datetime.now(timezone.utc)

        overflow_ratio = scenario.intensity * (scenario.duration_ms / 10000)
        message_loss = int(overflow_ratio * queue_depth * 0.3)
        dead_letter_size = int(overflow_ratio * queue_depth * 0.1)
        backlog_remaining = overflow_ratio * 0.4

        recovery_time = scenario.duration_ms * (1.5 + (1 - consumer_health) * 2)
        consumer_restored = consumer_health > 0.4 and scenario.intensity < 0.8

        status = RecoveryStatus.FAILED
        if scenario.intensity < 0.3:
            status = RecoveryStatus.RECOVERED
        elif scenario.intensity < 0.6:
            status = RecoveryStatus.PARTIAL
        elif message_loss > queue_depth * 0.2:
            status = RecoveryStatus.CATASTROPHIC

        return QueueRecoveryResult(
            queue_drained=scenario.intensity < 0.4 and consumer_restored,
            recovery_time_ms=min(recovery_time, 30000),
            message_loss_count=message_loss,
            dead_letter_queue_size=dead_letter_size,
            consumer_restored=consumer_restored,
            backlog_remaining_pct=backlog_remaining,
            recovery_status=status,
        )

    def validate_retry_catastrophe(
        self,
        scenario: CollapseScenario,
        base_retry_count: int = 3,
        max_retries_configured: int = 10,
    ) -> RetryCatastropheResult:
        """Detect if retry logic becomes catastrophic under failure conditions."""
        scenario.injection_timestamp = datetime.now(timezone.utc)

        if scenario.collapse_type == CollapseType.PROVIDER_OUTAGE:
            thundering_herd = scenario.intensity > 0.5
            max_depth = min(max_retries_configured, base_retry_count + int(scenario.intensity * 10))
            total_attempts = int(scenario.intensity * 1000)
            amplification = (scenario.intensity * 10) * (1 + (scenario.duration_ms / 10000))
        elif scenario.collapse_type == CollapseType.QUEUE_OVERFLOW:
            thundering_herd = scenario.intensity > 0.4
            max_depth = max_retries_configured
            total_attempts = int(scenario.intensity * 500)
            amplification = scenario.intensity * 5
        else:
            thundering_herd = scenario.intensity > 0.6
            max_depth = min(max_retries_configured, base_retry_count + 2)
            total_attempts = int(scenario.intensity * 200)
            amplification = scenario.intensity * 3

        backoff_broken = scenario.intensity > 0.7 and random.random() < 0.5
        timeout_chain = scenario.duration_ms > 10000 and scenario.intensity > 0.5
        catastrophic = amplification > 20 or max_depth >= max_retries_configured

        status = RecoveryStatus.FAILED
        if amplification < 5:
            status = RecoveryStatus.RECOVERED
        elif amplification < 15:
            status = RecoveryStatus.PARTIAL
        elif catastrophic:
            status = RecoveryStatus.CATASTROPHIC

        return RetryCatastropheResult(
            catastrophic=catastrophic,
            retry_amplification_factor=amplification,
            exponential_backoff_broken=backoff_broken,
            thundering_herd_triggered=thundering_herd,
            total_retry_attempts=total_attempts,
            timeout_chain_generated=timeout_chain,
            max_retry_depth=max_depth,
            recovery_status=status,
        )

    def validate_stale_state_recovery(
        self,
        scenario: CollapseScenario,
        disconnect_duration_ms: float,
        last_state_timestamp: datetime,
    ) -> StaleStateResult:
        """Detect stale/corrupt state persisting after reconnect."""
        scenario.injection_timestamp = datetime.now(timezone.utc)

        stale_threshold_sec = 30.0
        actual_stale_sec = disconnect_duration_ms / 1000

        stale_detected = actual_stale_sec > stale_threshold_sec
        zombie_elements = int(scenario.intensity * 20) if stale_detected else 0
        data_age = max(0, actual_stale_sec - (stale_threshold_sec / 2))
        memory_corruption = scenario.intensity > 0.7 and random.random() < scenario.intensity * 0.3
        cache_poisoning = scenario.intensity > 0.5 and random.random() < scenario.intensity * 0.4

        status = RecoveryStatus.FAILED
        if actual_stale_sec < stale_threshold_sec * 0.5:
            status = RecoveryStatus.RECOVERED
        elif actual_stale_sec < stale_threshold_sec:
            status = RecoveryStatus.PARTIAL
        elif memory_corruption or cache_poisoning:
            status = RecoveryStatus.CATASTROPHIC
        elif stale_detected:
            status = RecoveryStatus.STALE

        return StaleStateResult(
            stale_state_detected=stale_detected,
            stale_duration_sec=actual_stale_sec,
            stale_data_age_sec=data_age,
            zombie_ui_elements=zombie_elements,
            memory_corruption_detected=memory_corruption,
            cache_poisoning_detected=cache_poisoning,
            recovery_status=status,
        )

    def calculate_recovery_metrics(
        self,
        ws_result: Optional[WebSocketRecoveryResult] = None,
        queue_result: Optional[QueueRecoveryResult] = None,
        retry_result: Optional[RetryCatastropheResult] = None,
        stale_result: Optional[StaleStateResult] = None,
    ) -> RecoveryMetrics:
        """Calculate overall recovery metrics from component results."""
        recovery_times = []
        stability_scores = []
        corruption_pcts = []
        integrity_scores = []
        failure_risks = []

        if ws_result:
            recovery_times.append(ws_result.recovery_time_ms)
            stability_scores.append(1.0 if ws_result.recovery_status == RecoveryStatus.RECOVERED else 0.0)
            corruption_pcts.append(0.1 if ws_result.desync_detected else 0.0)
            integrity_scores.append(0.95 if not ws_result.stale_state_after_reconnect else 0.4)
            failure_risks.append(1.0 if ws_result.reconnection_storm_triggered else 0.0)

        if queue_result:
            recovery_times.append(queue_result.recovery_time_ms)
            stability_scores.append(1.0 if queue_result.recovery_status == RecoveryStatus.RECOVERED else 0.0)
            corruption_pcts.append(queue_result.message_loss_count / 1000)
            integrity_scores.append(1.0 - queue_result.backlog_remaining_pct)
            failure_risks.append(queue_result.dead_letter_queue_size / 100)

        if retry_result:
            recovery_times.append(retry_result.retry_amplification_factor * 1000)
            stability_scores.append(0.0 if retry_result.catastrophic else 0.8)
            corruption_pcts.append(1.0 if retry_result.timeout_chain_generated else 0.0)
            integrity_scores.append(0.2 if retry_result.catastrophic else 0.7)
            failure_risks.append(retry_result.retry_amplification_factor / 50)

        if stale_result:
            recovery_times.append(stale_result.stale_duration_sec * 1000)
            stability_scores.append(0.0 if stale_result.stale_state_detected else 1.0)
            corruption_pcts.append(1.0 if stale_result.memory_corruption_detected else 0.0)
            integrity_scores.append(0.3 if stale_result.stale_state_detected else 0.9)
            failure_risks.append(1.0 if stale_result.cache_poisoning_detected else 0.0)

        avg_recovery = sum(recovery_times) / len(recovery_times) if recovery_times else 0
        avg_stability = sum(stability_scores) / len(stability_scores) if stability_scores else 0
        avg_corruption = sum(corruption_pcts) / len(corruption_pcts) if corruption_pcts else 0
        avg_integrity = sum(integrity_scores) / len(integrity_scores) if integrity_scores else 0
        avg_failure_risk = sum(failure_risks) / len(failure_risks) if failure_risks else 0

        return RecoveryMetrics(
            recovery_time_ms=avg_recovery,
            recovery_stability_score=avg_stability,
            residual_corruption_pct=avg_corruption,
            post_recovery_integrity=avg_integrity,
            repeated_failure_risk=avg_failure_risk,
        )

    def run_full_recovery_validation(
        self,
        scenario: CollapseScenario,
        ws_available: bool = True,
        queue_available: bool = True,
        retry_available: bool = True,
        disconnect_duration_ms: float = 0.0,
        last_state_timestamp: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """Run complete recovery validation suite against a collapse scenario."""
        ws_result = self.validate_websocket_recovery(scenario) if ws_available else None
        queue_result = self.validate_queue_recovery(scenario) if queue_available else None
        retry_result = self.validate_retry_catastrophe(scenario) if retry_available else None

        stale_result = None
        if disconnect_duration_ms > 0:
            stale_result = self.validate_stale_state_recovery(
                scenario,
                disconnect_duration_ms,
                last_state_timestamp or datetime.now(timezone.utc),
            )

        metrics = self.calculate_recovery_metrics(
            ws_result=ws_result,
            queue_result=queue_result,
            retry_result=retry_result,
            stale_result=stale_result,
        )

        self._scenarios_run.append(scenario)
        result = {
            "scenario": scenario.to_dict(),
            "websocket_recovery": ws_result.to_dict() if ws_result else None,
            "queue_recovery": queue_result.to_dict() if queue_result else None,
            "retry_catastrophe": retry_result.to_dict() if retry_result else None,
            "stale_state": stale_result.to_dict() if stale_result else None,
            "metrics": metrics.to_dict(),
            "can_survive_collapse": metrics.recovery_stability_score > 0.5,
            "retry_logic_catastrophic": retry_result.catastrophic if retry_result else False,
            "stale_state_after_reconnect": stale_result.stale_state_detected if stale_result else False,
        }
        self._results.append(result)
        return result

    def get_survival_score(self) -> float:
        """Calculate overall system survival probability."""
        if not self._results:
            return 0.5
        scores = []
        for r in self._results:
            metrics = r.get("metrics", {})
            survival = (
                metrics.get("recovery_stability_score", 0) * 0.4
                + metrics.get("post_recovery_integrity", 0) * 0.3
                + (1 - metrics.get("repeated_failure_risk", 0)) * 0.3
            )
            scores.append(survival)
        return round(sum(scores) / len(scores), 4)
