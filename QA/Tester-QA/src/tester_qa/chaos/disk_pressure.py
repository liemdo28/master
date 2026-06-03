"""
Disk Pressure Engine
Simulates log explosions, temp accumulation, and storage starvation.
"""
import asyncio
import os
import random
import time
import tempfile
import shutil
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class DiskPressureMode(Enum):
    LOG_EXPLOSION = "log_explosion"
    TEMP_ACCUMULATION = "temp_accumulation"
    STORAGE_STARVATION = "storage_starvation"
    FILE_DESCRIPTOR_EXHAUSTION = "file_descriptor_exhaustion"
    IO_STORM = "io_storm"
    SMALL_FILE_FLOOD = "small_file_flood"


@dataclass
class DiskPressureConfig:
    mode: DiskPressureMode
    intensity: float = 0.5  # 0.0-1.0
    target_dir: str = "/tmp/tester-qa-chaos"
    file_size_mb: int = 10
    num_files: int = 100
    write_size_mb: int = 100
    duration_ms: int = 30000


@dataclass
class DiskPressureEvent:
    timestamp: float
    mode: DiskPressureMode
    bytes_written: int
    files_created: int
    details: dict = field(default_factory=dict)


class DiskPressureEngine:
    """
    Creates disk pressure to test system resilience.
    """

    def __init__(self):
        self.active_pressures: dict[str, DiskPressureConfig] = {}
        self.pressure_log: list[DiskPressureEvent] = []
        self._created_files: list[str] = []
        self._open_handles: list[Any] = []
        self._running = False

    def configure_pressure(self, target: str, config: DiskPressureConfig):
        self.active_pressures[target] = config

    def clear_pressure(self, target: str):
        self.active_pressures.pop(target, None)

    def clear_all(self):
        self.active_pressures.clear()
        self._cleanup_files()
        self._close_handles()

    def _cleanup_files(self):
        """Clean up created files."""
        for f in self._created_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass
        self._created_files.clear()

    def _close_handles(self):
        """Close open file handles."""
        for handle in self._open_handles:
            try:
                handle.close()
            except Exception:
                pass
        self._open_handles.clear()

    def get_disk_usage(self, path: str = "/") -> dict:
        """Get disk usage statistics."""
        try:
            import psutil
            usage = psutil.disk_usage(path)
            return {
                "total_gb": usage.total / (1024 ** 3),
                "used_gb": usage.used / (1024 ** 3),
                "free_gb": usage.free / (1024 ** 3),
                "percent": usage.percent,
            }
        except ImportError:
            return {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0}

    async def apply_disk_pressure(self, target: str):
        """Apply disk pressure to target system."""
        if target not in self.active_pressures:
            return

        config = self.active_pressures[target]
        mode = config.mode
        self._running = True

        start_time = time.time()
        duration = config.duration_ms / 1000

        while self._running and (time.time() - start_time) < duration:
            bytes_written = 0
            files_created = 0

            if mode == DiskPressureMode.LOG_EXPLOSION:
                bytes_written, files_created = await self._log_explosion(config)
            elif mode == DiskPressureMode.TEMP_ACCUMULATION:
                bytes_written, files_created = await self._temp_accumulation(config)
            elif mode == DiskPressureMode.STORAGE_STARVATION:
                bytes_written, files_created = await self._storage_starvation(config)
            elif mode == DiskPressureMode.FILE_DESCRIPTOR_EXHAUSTION:
                await self._fd_exhaustion(config)
            elif mode == DiskPressureMode.IO_STORM:
                bytes_written, files_created = await self._io_storm(config)
            elif mode == DiskPressureMode.SMALL_FILE_FLOOD:
                bytes_written, files_created = await self._small_file_flood(config)

            self.pressure_log.append(DiskPressureEvent(
                timestamp=time.time(),
                mode=mode,
                bytes_written=bytes_written,
                files_created=files_created,
                details={
                    "target": target,
                    "intensity": config.intensity,
                }
            ))

            await asyncio.sleep(1.0)  # Every second

    async def _log_explosion(self, config: DiskPressureConfig) -> tuple:
        """Create log explosion by writing massive log files."""
        target_dir = config.target_dir
        os.makedirs(target_dir, exist_ok=True)

        bytes_written = 0
        files_created = 0
        num_files = int(config.num_files * config.intensity)

        for i in range(num_files):
            log_file = os.path.join(target_dir, f"chaos_log_{time.time()}_{i}.log")
            log_data = self._generate_log_entry()
            file_size = int(config.file_size_mb * 1024 * 1024 * config.intensity)

            with open(log_file, 'w') as f:
                written = 0
                while written < file_size:
                    chunk = log_data * 1000
                    f.write(chunk)
                    written += len(chunk.encode())
                    bytes_written += len(chunk.encode())

            self._created_files.append(log_file)
            files_created += 1

        return bytes_written, files_created

    def _generate_log_entry(self) -> str:
        """Generate a realistic log entry."""
        timestamp = time.time()
        levels = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]
        messages = [
            "Processing request",
            "Database query executed",
            "Cache hit",
            "API call completed",
            "Connection established",
            "Transaction committed",
            "Message processed",
            "Task completed",
            "Worker started",
            "Shutdown initiated",
        ]
        return (
            f"{timestamp} [{random.choice(levels)}] "
            f"worker-{random.randint(1, 100)} - "
            f"{random.choice(messages)} "
            f"duration={random.uniform(0.001, 5.0):.4f}s "
            f"request_id={random.randint(100000, 999999)}\n"
        )

    async def _temp_accumulation(self, config: DiskPressureConfig) -> tuple:
        """Accumulate temp files."""
        target_dir = config.target_dir
        os.makedirs(target_dir, exist_ok=True)

        bytes_written = 0
        files_created = 0
        num_files = int(config.num_files * config.intensity)

        for i in range(num_files):
            temp_file = os.path.join(target_dir, f".temp_{time.time()}_{i}.tmp")
            size = random.randint(1024, 1024 * 1024)  # 1KB to 1MB
            data = os.urandom(size)

            with open(temp_file, 'wb') as f:
                f.write(data)
                bytes_written += size

            self._created_files.append(temp_file)
            files_created += 1

        return bytes_written, files_created

    async def _storage_starvation(self, config: DiskPressureConfig) -> tuple:
        """Fill up disk space."""
        target_dir = config.target_dir
        os.makedirs(target_dir, exist_ok=True)

        bytes_written = 0
        files_created = 0
        size_mb = int(config.write_size_mb * config.intensity)

        fill_file = os.path.join(target_dir, f"starvation_{time.time()}.fill")
        chunk_size = 1024 * 1024  # 1MB chunks

        with open(fill_file, 'wb') as f:
            for _ in range(size_mb):
                f.write(os.urandom(chunk_size))
                bytes_written += chunk_size
                files_created = 1

        self._created_files.append(fill_file)
        return bytes_written, files_created

    async def _fd_exhaustion(self, config: DiskPressureConfig):
        """Exhaust file descriptors by keeping many files open."""
        target_dir = config.target_dir
        os.makedirs(target_dir, exist_ok=True)

        num_handles = int(100 * config.intensity)

        for i in range(num_handles):
            log_file = os.path.join(target_dir, f"handle_{time.time()}_{i}.log")
            handle = open(log_file, 'w')
            handle.write(f"Keeping file descriptor open {i}\n")
            self._open_handles.append(handle)
            self._created_files.append(log_file)

    async def _io_storm(self, config: DiskPressureConfig) -> tuple:
        """Create IO storm with rapid read/write cycles."""
        target_dir = config.target_dir
        os.makedirs(target_dir, exist_ok=True)

        bytes_written = 0
        files_created = 0
        num_cycles = int(50 * config.intensity)

        for i in range(num_cycles):
            io_file = os.path.join(target_dir, f"io_storm_{time.time()}_{i}.dat")
            data = os.urandom(1024 * 1024)  # 1MB

            # Write
            with open(io_file, 'wb') as f:
                f.write(data)
                bytes_written += len(data)

            # Read
            with open(io_file, 'rb') as f:
                f.read()

            files_created += 1
            self._created_files.append(io_file)

        return bytes_written, files_created

    async def _small_file_flood(self, config: DiskPressureConfig) -> tuple:
        """Flood with tiny files."""
        target_dir = config.target_dir
        os.makedirs(target_dir, exist_ok=True)

        bytes_written = 0
        files_created = 0
        num_files = int(config.num_files * config.intensity * 10)  # Many small files

        for i in range(num_files):
            small_file = os.path.join(target_dir, f"small_{time.time()}_{i}.txt")
            content = f"Small file {i} at {time.time()}\n"

            with open(small_file, 'w') as f:
                f.write(content)
                bytes_written += len(content.encode())

            self._created_files.append(small_file)
            files_created += 1

        return bytes_written, files_created

    def trigger_disk_collapse(self, target: str):
        """Trigger disk collapse scenario."""
        config = self.active_pressures.get(target, DiskPressureConfig(
            mode=DiskPressureMode.STORAGE_STARVATION,
            intensity=1.0,
            write_size_mb=1000,
        ))

        asyncio.create_task(self.apply_disk_pressure(target))

        self.pressure_log.append(DiskPressureEvent(
            timestamp=time.time(),
            mode=DiskPressureMode.STORAGE_STARVATION,
            bytes_written=0,
            files_created=0,
            details={"target": target, "collapse": True},
        ))

    def get_pressure_stats(self) -> dict:
        """Get disk pressure statistics."""
        disk = self.get_disk_usage()
        return {
            "current_disk_free_gb": disk.get("free_gb", 0),
            "current_disk_percent": disk.get("percent", 0),
            "files_created": len(self._created_files),
            "open_handles": len(self._open_handles),
            "active_pressures": len(self.active_pressures),
            "pressure_events": len(self.pressure_log),
        }

    def export_pressure_log(self) -> list[dict]:
        """Export pressure log."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "bytes_written": e.bytes_written,
                "files_created": e.files_created,
                "details": e.details,
            }
            for e in self.pressure_log
        ]


# Global singleton
_disk_pressure_engine: Optional[DiskPressureEngine] = None


def get_disk_pressure_engine() -> DiskPressureEngine:
    global _disk_pressure_engine
    if _disk_pressure_engine is None:
        _disk_pressure_engine = DiskPressureEngine()
    return _disk_pressure_engine
