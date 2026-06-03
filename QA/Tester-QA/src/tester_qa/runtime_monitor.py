from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path

from tester_qa.incidents import IncidentRegistry
from tester_qa.models import RuntimeAnomaly, RuntimeSnapshot, Severity


LOGGER = logging.getLogger(__name__)


class RuntimeMonitor:
    def __init__(self, incident_registry: IncidentRegistry | None = None) -> None:
        self.incident_registry = incident_registry or IncidentRegistry()

    def snapshot(
        self,
        websocket_count: int = 0,
        queue_depth: int = 0,
        provider_latency_ms: int = 0,
        retry_storms: int = 0,
        stuck_workers: int = 0,
        failed_executions: int = 0,
    ) -> RuntimeSnapshot:
        cpu = _load_average_cpu_proxy()
        memory = _memory_percent_proxy()
        disk = _disk_percent(Path.cwd())
        process_count = _process_count()
        return RuntimeSnapshot(
            cpu_percent=cpu,
            memory_percent=memory,
            disk_percent=disk,
            process_count=process_count,
            websocket_count=websocket_count,
            queue_depth=queue_depth,
            provider_latency_ms=provider_latency_ms,
            retry_storms=retry_storms,
            stuck_workers=stuck_workers,
            failed_executions=failed_executions,
        )

    def detect_anomalies(self, snapshot: RuntimeSnapshot) -> list[RuntimeAnomaly]:
        anomalies: list[RuntimeAnomaly] = []
        if snapshot.cpu_percent >= 90:
            anomalies.append(RuntimeAnomaly("cpu_saturation", Severity.HIGH, "CPU pressure exceeds safe threshold.", f"{snapshot.cpu_percent:.1f}%"))
        if snapshot.memory_percent >= 90:
            anomalies.append(RuntimeAnomaly("memory_pressure", Severity.HIGH, "Memory pressure exceeds safe threshold.", f"{snapshot.memory_percent:.1f}%"))
        if snapshot.disk_percent >= 92:
            anomalies.append(RuntimeAnomaly("disk_pressure", Severity.HIGH, "Disk utilization threatens runtime stability.", f"{snapshot.disk_percent:.1f}%"))
        if snapshot.queue_depth >= 100:
            anomalies.append(RuntimeAnomaly("queue_overload", Severity.HIGH, "Queue depth indicates backpressure failure risk.", str(snapshot.queue_depth)))
        if snapshot.provider_latency_ms >= 5000:
            anomalies.append(RuntimeAnomaly("provider_latency", Severity.HIGH, "Provider latency exceeds operating SLO.", f"{snapshot.provider_latency_ms}ms"))
        if snapshot.retry_storms > 0:
            anomalies.append(RuntimeAnomaly("retry_storm", Severity.CRITICAL, "Retry storm detected.", str(snapshot.retry_storms)))
        if snapshot.stuck_workers > 0:
            anomalies.append(RuntimeAnomaly("stuck_workers", Severity.HIGH, "Worker deadlock or stuck execution detected.", str(snapshot.stuck_workers)))
        if snapshot.failed_executions > 0:
            anomalies.append(RuntimeAnomaly("failed_executions", Severity.MEDIUM, "Failed executions detected.", str(snapshot.failed_executions)))
        return anomalies

    def generate_incidents(self, anomalies: list[RuntimeAnomaly]) -> list[str]:
        incident_ids: list[str] = []
        for anomaly in anomalies:
            incident = self.incident_registry.create(
                title=f"Runtime anomaly: {anomaly.name}",
                summary=anomaly.detail,
                severity=anomaly.severity,
            )
            incident_ids.append(incident.incident_id)
        return incident_ids


def _load_average_cpu_proxy() -> float:
    try:
        load1, _, _ = os.getloadavg()
        cpu_count = max(os.cpu_count() or 1, 1)
        return min((load1 / cpu_count) * 100, 100.0)
    except OSError:
        return 0.0


def _memory_percent_proxy() -> float:
    try:
        pages = os.sysconf("SC_PHYS_PAGES")
        available = os.sysconf("SC_AVPHYS_PAGES")
        if pages <= 0:
            return 0.0
        return max(0.0, min(((pages - available) / pages) * 100, 100.0))
    except (ValueError, OSError, AttributeError):
        return 0.0


def _disk_percent(path: Path) -> float:
    usage = shutil.disk_usage(path)
    return (usage.used / usage.total) * 100


def _process_count() -> int:
    proc = Path("/proc")
    if proc.exists():
        return len([item for item in proc.iterdir() if item.name.isdigit()])
    try:
        completed = subprocess.run(["ps", "-axo", "pid="], capture_output=True, text=True, timeout=2, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return 0
    if completed.returncode != 0:
        return 0
    return len([line for line in completed.stdout.splitlines() if line.strip()])
