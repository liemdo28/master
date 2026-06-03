"""Runtime Snapshot Module - Captures system state at a point in time."""

import os
import platform
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class ProcessInfo:
    """Information about a running process."""
    pid: int
    name: str
    cpu_percent: float
    memory_mb: float
    status: str
    threads: int = 0
    open_files: int = 0


@dataclass
class ConnectionInfo:
    """Information about a network connection."""
    local_address: str
    remote_address: Optional[str]
    status: str
    protocol: str
    pid: Optional[int] = None


@dataclass
class DiskInfo:
    """Information about disk usage."""
    mount_point: str
    total_gb: float
    used_gb: float
    free_gb: float
    percent_used: float


@dataclass
class Snapshot:
    """Complete system state snapshot."""
    snapshot_id: str
    timestamp: datetime
    memory: Dict[str, Any]
    cpu: Dict[str, Any]
    processes: List[ProcessInfo]
    connections: List[ConnectionInfo]
    disk: List[DiskInfo]
    environment: Dict[str, str] = field(default_factory=dict)
    custom_metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Export snapshot as dictionary."""
        return {
            "snapshot_id": self.snapshot_id,
            "timestamp": self.timestamp.isoformat(),
            "memory": self.memory,
            "cpu": self.cpu,
            "processes": [
                {
                    "pid": p.pid,
                    "name": p.name,
                    "cpu_percent": p.cpu_percent,
                    "memory_mb": p.memory_mb,
                    "status": p.status,
                    "threads": p.threads,
                    "open_files": p.open_files,
                }
                for p in self.processes
            ],
            "connections": [
                {
                    "local_address": c.local_address,
                    "remote_address": c.remote_address,
                    "status": c.status,
                    "protocol": c.protocol,
                    "pid": c.pid,
                }
                for c in self.connections
            ],
            "disk": [
                {
                    "mount_point": d.mount_point,
                    "total_gb": d.total_gb,
                    "used_gb": d.used_gb,
                    "free_gb": d.free_gb,
                    "percent_used": d.percent_used,
                }
                for d in self.disk
            ],
            "environment": self.environment,
            "custom_metrics": self.custom_metrics,
        }


@dataclass
class SnapshotDiff:
    """Differences between two snapshots."""
    before_id: str
    after_id: str
    time_delta_seconds: float
    memory_changes: Dict[str, Any]
    cpu_changes: Dict[str, Any]
    process_changes: Dict[str, List[Any]]
    connection_changes: Dict[str, List[Any]]
    disk_changes: Dict[str, Any]
    anomalies: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        """Export diff as dictionary."""
        return {
            "before_id": self.before_id,
            "after_id": self.after_id,
            "time_delta_seconds": self.time_delta_seconds,
            "memory_changes": self.memory_changes,
            "cpu_changes": self.cpu_changes,
            "process_changes": self.process_changes,
            "connection_changes": self.connection_changes,
            "disk_changes": self.disk_changes,
            "anomalies": self.anomalies,
        }


class RuntimeSnapshot:
    """Captures and analyzes system state snapshots."""

    def __init__(self) -> None:
        self._snapshots: List[Snapshot] = []
        self._snapshot_counter: int = 0
        self._anomaly_thresholds: Dict[str, float] = {
            "memory_percent_change": 20.0,
            "cpu_percent_change": 50.0,
            "process_count_change": 10,
            "connection_count_change": 20,
            "disk_percent_change": 5.0,
        }

    async def capture_snapshot(
        self,
        custom_metrics: Optional[Dict[str, Any]] = None,
        include_env: bool = False,
    ) -> Snapshot:
        """Capture a snapshot of the current system state.

        Args:
            custom_metrics: Optional application-specific metrics to include.
            include_env: Whether to include environment variables.

        Returns:
            Snapshot of current system state.
        """
        self._snapshot_counter += 1
        snapshot_id = f"snap-{self._snapshot_counter:06d}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        memory = self._capture_memory()
        cpu = self._capture_cpu()
        processes = self._capture_processes()
        connections = self._capture_connections()
        disk = self._capture_disk()
        environment = self._capture_environment() if include_env else {}

        snapshot = Snapshot(
            snapshot_id=snapshot_id,
            timestamp=datetime.utcnow(),
            memory=memory,
            cpu=cpu,
            processes=processes,
            connections=connections,
            disk=disk,
            environment=environment,
            custom_metrics=custom_metrics or {},
        )

        self._snapshots.append(snapshot)
        return snapshot

    def compare_snapshots(
        self,
        before: Snapshot,
        after: Snapshot,
    ) -> SnapshotDiff:
        """Compare two snapshots and identify differences.

        Args:
            before: The earlier snapshot.
            after: The later snapshot.

        Returns:
            SnapshotDiff with all identified changes.
        """
        time_delta = (after.timestamp - before.timestamp).total_seconds()

        memory_changes = self._compare_memory(before.memory, after.memory)
        cpu_changes = self._compare_cpu(before.cpu, after.cpu)
        process_changes = self._compare_processes(before.processes, after.processes)
        connection_changes = self._compare_connections(before.connections, after.connections)
        disk_changes = self._compare_disk(before.disk, after.disk)

        anomalies = self._detect_anomalies_from_diff(
            memory_changes, cpu_changes, process_changes, connection_changes, disk_changes
        )

        return SnapshotDiff(
            before_id=before.snapshot_id,
            after_id=after.snapshot_id,
            time_delta_seconds=time_delta,
            memory_changes=memory_changes,
            cpu_changes=cpu_changes,
            process_changes=process_changes,
            connection_changes=connection_changes,
            disk_changes=disk_changes,
            anomalies=anomalies,
        )

    def detect_anomalies(
        self,
        snapshot: Optional[Snapshot] = None,
    ) -> List[Dict[str, Any]]:
        """Detect anomalies in a snapshot or across snapshot history.

        Args:
            snapshot: Optional specific snapshot to analyze. Uses latest if None.

        Returns:
            List of detected anomalies.
        """
        anomalies: List[Dict[str, Any]] = []

        target = snapshot if snapshot else (self._snapshots[-1] if self._snapshots else None)
        if not target:
            return anomalies

        # Check memory anomalies
        mem_used = target.memory.get("percent_used", 0)
        if mem_used > 90:
            anomalies.append({
                "type": "memory_critical",
                "severity": "critical",
                "description": f"Memory usage at {mem_used}%",
                "value": mem_used,
                "threshold": 90,
            })
        elif mem_used > 75:
            anomalies.append({
                "type": "memory_high",
                "severity": "warning",
                "description": f"Memory usage at {mem_used}%",
                "value": mem_used,
                "threshold": 75,
            })

        # Check CPU anomalies
        cpu_used = target.cpu.get("percent_used", 0)
        if cpu_used > 95:
            anomalies.append({
                "type": "cpu_critical",
                "severity": "critical",
                "description": f"CPU usage at {cpu_used}%",
                "value": cpu_used,
                "threshold": 95,
            })
        elif cpu_used > 80:
            anomalies.append({
                "type": "cpu_high",
                "severity": "warning",
                "description": f"CPU usage at {cpu_used}%",
                "value": cpu_used,
                "threshold": 80,
            })

        # Check disk anomalies
        for disk in target.disk:
            if disk.percent_used > 95:
                anomalies.append({
                    "type": "disk_critical",
                    "severity": "critical",
                    "description": f"Disk {disk.mount_point} at {disk.percent_used}%",
                    "value": disk.percent_used,
                    "threshold": 95,
                    "mount_point": disk.mount_point,
                })
            elif disk.percent_used > 85:
                anomalies.append({
                    "type": "disk_high",
                    "severity": "warning",
                    "description": f"Disk {disk.mount_point} at {disk.percent_used}%",
                    "value": disk.percent_used,
                    "threshold": 85,
                    "mount_point": disk.mount_point,
                })

        # Check for zombie processes
        zombie_procs = [p for p in target.processes if p.status == "zombie"]
        if zombie_procs:
            anomalies.append({
                "type": "zombie_processes",
                "severity": "warning",
                "description": f"{len(zombie_procs)} zombie process(es) detected",
                "value": len(zombie_procs),
                "pids": [p.pid for p in zombie_procs],
            })

        # Compare with previous snapshot if available
        if len(self._snapshots) >= 2 and target == self._snapshots[-1]:
            prev = self._snapshots[-2]
            diff = self.compare_snapshots(prev, target)
            anomalies.extend(diff.anomalies)

        return anomalies

    def get_snapshot_history(self) -> List[Snapshot]:
        """Return all captured snapshots."""
        return self._snapshots

    def _capture_memory(self) -> Dict[str, Any]:
        """Capture current memory state."""
        try:
            import psutil
            mem = psutil.virtual_memory()
            return {
                "total_mb": round(mem.total / (1024 * 1024), 2),
                "available_mb": round(mem.available / (1024 * 1024), 2),
                "used_mb": round(mem.used / (1024 * 1024), 2),
                "percent_used": mem.percent,
            }
        except ImportError:
            return {
                "total_mb": 0,
                "available_mb": 0,
                "used_mb": 0,
                "percent_used": 0,
                "note": "psutil not available",
            }

    def _capture_cpu(self) -> Dict[str, Any]:
        """Capture current CPU state."""
        try:
            import psutil
            return {
                "percent_used": psutil.cpu_percent(interval=0.1),
                "count_logical": psutil.cpu_count(logical=True),
                "count_physical": psutil.cpu_count(logical=False),
                "load_avg": list(os.getloadavg()) if hasattr(os, "getloadavg") else [],
            }
        except ImportError:
            return {
                "percent_used": 0,
                "count_logical": os.cpu_count() or 0,
                "count_physical": 0,
                "load_avg": list(os.getloadavg()) if hasattr(os, "getloadavg") else [],
                "note": "psutil not available",
            }

    def _capture_processes(self) -> List[ProcessInfo]:
        """Capture current process list."""
        processes: List[ProcessInfo] = []
        try:
            import psutil
            for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info", "status", "num_threads"]):
                try:
                    info = proc.info
                    mem_mb = info.get("memory_info")
                    processes.append(ProcessInfo(
                        pid=info["pid"],
                        name=info.get("name", "unknown"),
                        cpu_percent=info.get("cpu_percent", 0.0) or 0.0,
                        memory_mb=round(mem_mb.rss / (1024 * 1024), 2) if mem_mb else 0.0,
                        status=info.get("status", "unknown"),
                        threads=info.get("num_threads", 0) or 0,
                    ))
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except ImportError:
            pass
        return processes

    def _capture_connections(self) -> List[ConnectionInfo]:
        """Capture current network connections."""
        connections: List[ConnectionInfo] = []
        try:
            import psutil
            for conn in psutil.net_connections(kind="inet"):
                local = f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else "unknown"
                remote = f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None
                connections.append(ConnectionInfo(
                    local_address=local,
                    remote_address=remote,
                    status=conn.status,
                    protocol="tcp" if conn.type == 1 else "udp",
                    pid=conn.pid,
                ))
        except (ImportError, PermissionError):
            pass
        return connections

    def _capture_disk(self) -> List[DiskInfo]:
        """Capture current disk usage."""
        disks: List[DiskInfo] = []
        try:
            import psutil
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disks.append(DiskInfo(
                        mount_point=partition.mountpoint,
                        total_gb=round(usage.total / (1024 ** 3), 2),
                        used_gb=round(usage.used / (1024 ** 3), 2),
                        free_gb=round(usage.free / (1024 ** 3), 2),
                        percent_used=usage.percent,
                    ))
                except (PermissionError, OSError):
                    continue
        except ImportError:
            pass
        return disks

    def _capture_environment(self) -> Dict[str, str]:
        """Capture environment information (non-sensitive)."""
        safe_keys = [
            "PATH", "HOME", "USER", "SHELL", "LANG", "TERM",
            "HOSTNAME", "PWD", "VIRTUAL_ENV", "NODE_ENV", "PYTHON_PATH",
        ]
        env: Dict[str, str] = {}
        for key in safe_keys:
            value = os.environ.get(key)
            if value:
                env[key] = value
        env["platform"] = platform.platform()
        env["python_version"] = platform.python_version()
        return env

    def _compare_memory(
        self, before: Dict[str, Any], after: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compare memory states."""
        return {
            "used_mb_delta": after.get("used_mb", 0) - before.get("used_mb", 0),
            "percent_delta": after.get("percent_used", 0) - before.get("percent_used", 0),
            "before_percent": before.get("percent_used", 0),
            "after_percent": after.get("percent_used", 0),
        }

    def _compare_cpu(
        self, before: Dict[str, Any], after: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compare CPU states."""
        return {
            "percent_delta": after.get("percent_used", 0) - before.get("percent_used", 0),
            "before_percent": before.get("percent_used", 0),
            "after_percent": after.get("percent_used", 0),
        }

    def _compare_processes(
        self, before: List[ProcessInfo], after: List[ProcessInfo]
    ) -> Dict[str, List[Any]]:
        """Compare process lists."""
        before_pids = {p.pid for p in before}
        after_pids = {p.pid for p in after}

        new_pids = after_pids - before_pids
        gone_pids = before_pids - after_pids

        new_procs = [p for p in after if p.pid in new_pids]
        gone_procs = [p for p in before if p.pid in gone_pids]

        return {
            "new_processes": [{"pid": p.pid, "name": p.name} for p in new_procs],
            "terminated_processes": [{"pid": p.pid, "name": p.name} for p in gone_procs],
            "count_delta": len(after) - len(before),
        }

    def _compare_connections(
        self, before: List[ConnectionInfo], after: List[ConnectionInfo]
    ) -> Dict[str, List[Any]]:
        """Compare network connections."""
        before_set = {(c.local_address, c.remote_address or "", c.protocol) for c in before}
        after_set = {(c.local_address, c.remote_address or "", c.protocol) for c in after}

        new_conns = after_set - before_set
        gone_conns = before_set - after_set

        return {
            "new_connections": [{"local": c[0], "remote": c[1], "protocol": c[2]} for c in new_conns],
            "closed_connections": [{"local": c[0], "remote": c[1], "protocol": c[2]} for c in gone_conns],
            "count_delta": len(after) - len(before),
        }

    def _compare_disk(
        self, before: List[DiskInfo], after: List[DiskInfo]
    ) -> Dict[str, Any]:
        """Compare disk states."""
        changes: Dict[str, Any] = {}
        before_map = {d.mount_point: d for d in before}
        after_map = {d.mount_point: d for d in after}

        for mount, after_disk in after_map.items():
            before_disk = before_map.get(mount)
            if before_disk:
                changes[mount] = {
                    "used_gb_delta": round(after_disk.used_gb - before_disk.used_gb, 2),
                    "percent_delta": round(after_disk.percent_used - before_disk.percent_used, 2),
                }
        return changes

    def _detect_anomalies_from_diff(
        self,
        memory_changes: Dict[str, Any],
        cpu_changes: Dict[str, Any],
        process_changes: Dict[str, List[Any]],
        connection_changes: Dict[str, List[Any]],
        disk_changes: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Detect anomalies from a snapshot diff."""
        anomalies: List[Dict[str, Any]] = []

        mem_delta = abs(memory_changes.get("percent_delta", 0))
        if mem_delta > self._anomaly_thresholds["memory_percent_change"]:
            anomalies.append({
                "type": "memory_spike",
                "severity": "warning",
                "description": f"Memory usage changed by {mem_delta:.1f}%",
                "value": mem_delta,
                "threshold": self._anomaly_thresholds["memory_percent_change"],
            })

        cpu_delta = abs(cpu_changes.get("percent_delta", 0))
        if cpu_delta > self._anomaly_thresholds["cpu_percent_change"]:
            anomalies.append({
                "type": "cpu_spike",
                "severity": "warning",
                "description": f"CPU usage changed by {cpu_delta:.1f}%",
                "value": cpu_delta,
                "threshold": self._anomaly_thresholds["cpu_percent_change"],
            })

        proc_delta = abs(process_changes.get("count_delta", 0))
        if proc_delta > self._anomaly_thresholds["process_count_change"]:
            anomalies.append({
                "type": "process_count_change",
                "severity": "warning",
                "description": f"Process count changed by {proc_delta}",
                "value": proc_delta,
                "threshold": self._anomaly_thresholds["process_count_change"],
            })

        conn_delta = abs(connection_changes.get("count_delta", 0))
        if conn_delta > self._anomaly_thresholds["connection_count_change"]:
            anomalies.append({
                "type": "connection_count_change",
                "severity": "warning",
                "description": f"Connection count changed by {conn_delta}",
                "value": conn_delta,
                "threshold": self._anomaly_thresholds["connection_count_change"],
            })

        return anomalies
