"""Runtime Destroyer Module"""

import os
import signal
import subprocess
import tempfile
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class DestructionResult:
    """Result of a runtime destruction operation."""
    success: bool
    target: str
    action: str
    message: str


class RuntimeDestroyer:
    """Tests runtime resilience by simulating destructive conditions."""

    def __init__(self):
        self._platform = os.uname().sysname.lower()
        self._temp_files: List[str] = []

    def kill_runtime(
        self, pid: int, signal_type: str = "TERM"
    ) -> DestructionResult:
        """Kill a runtime process with a specified signal."""
        signal_map = {
            "TERM": signal.SIGTERM,
            "KILL": signal.SIGKILL,
            "INT": signal.SIGINT,
            "HUP": signal.SIGHUP,
            "STOP": signal.SIGSTOP,
            "CONT": signal.SIGCONT,
        }

        sig = signal_map.get(signal_type.upper())
        if sig is None:
            return DestructionResult(
                success=False,
                target=str(pid),
                action="kill_runtime",
                message=f"Unknown signal type: {signal_type}",
            )

        try:
            os.kill(pid, sig)
            return DestructionResult(
                success=True,
                target=str(pid),
                action="kill_runtime",
                message=f"Sent {signal_type} to process {pid}",
            )
        except ProcessLookupError:
            return DestructionResult(
                success=False,
                target=str(pid),
                action="kill_runtime",
                message=f"Process {pid} not found",
            )
        except PermissionError:
            return DestructionResult(
                success=False,
                target=str(pid),
                action="kill_runtime",
                message=f"Permission denied to signal process {pid}",
            )

    def corrupt_state(
        self, target_path: str, corruption_type: str = "truncate"
    ) -> DestructionResult:
        """Corrupt a state file to test resilience."""
        if not os.path.exists(target_path):
            return DestructionResult(
                success=False,
                target=target_path,
                action="corrupt_state",
                message=f"Target path does not exist: {target_path}",
            )

        try:
            if corruption_type == "truncate":
                with open(target_path, "w") as f:
                    f.truncate(0)
                message = f"Truncated file: {target_path}"

            elif corruption_type == "garbage":
                with open(target_path, "wb") as f:
                    f.write(os.urandom(1024))
                message = f"Wrote garbage data to: {target_path}"

            elif corruption_type == "partial":
                with open(target_path, "rb") as f:
                    content = f.read()
                # Write only first half
                with open(target_path, "wb") as f:
                    f.write(content[: len(content) // 2])
                message = f"Partially corrupted: {target_path}"

            elif corruption_type == "permissions":
                os.chmod(target_path, 0o000)
                message = f"Removed all permissions: {target_path}"

            else:
                return DestructionResult(
                    success=False,
                    target=target_path,
                    action="corrupt_state",
                    message=f"Unknown corruption type: {corruption_type}",
                )

            return DestructionResult(
                success=True,
                target=target_path,
                action="corrupt_state",
                message=message,
            )
        except OSError as e:
            return DestructionResult(
                success=False,
                target=target_path,
                action="corrupt_state",
                message=f"Failed to corrupt state: {e}",
            )

    def exhaust_resources(
        self, resource_type: str = "memory", limit_mb: int = 100
    ) -> DestructionResult:
        """Exhaust system resources to test resilience (with safety limits)."""
        if resource_type == "memory":
            return self._exhaust_memory(limit_mb)
        elif resource_type == "disk":
            return self._exhaust_disk(limit_mb)
        elif resource_type == "file_descriptors":
            return self._exhaust_file_descriptors()
        else:
            return DestructionResult(
                success=False,
                target=resource_type,
                action="exhaust_resources",
                message=f"Unknown resource type: {resource_type}",
            )

    def _exhaust_memory(self, limit_mb: int) -> DestructionResult:
        """Allocate memory up to a limit to simulate memory pressure."""
        # Safety cap at 500MB
        limit_mb = min(limit_mb, 500)
        try:
            # Allocate in chunks
            chunks: List[bytes] = []
            chunk_size = 1024 * 1024  # 1MB
            for _ in range(limit_mb):
                chunks.append(b"\x00" * chunk_size)

            # Release immediately after test
            del chunks
            return DestructionResult(
                success=True,
                target="memory",
                action="exhaust_resources",
                message=f"Allocated and released {limit_mb}MB of memory",
            )
        except MemoryError:
            return DestructionResult(
                success=True,
                target="memory",
                action="exhaust_resources",
                message=f"Memory exhaustion triggered before reaching {limit_mb}MB",
            )

    def _exhaust_disk(self, limit_mb: int) -> DestructionResult:
        """Create temporary files to simulate disk pressure."""
        # Safety cap at 500MB
        limit_mb = min(limit_mb, 500)
        try:
            temp_dir = tempfile.mkdtemp(prefix="tester_qa_disk_")
            temp_path = os.path.join(temp_dir, "exhaust.bin")
            chunk_size = 1024 * 1024  # 1MB

            with open(temp_path, "wb") as f:
                for _ in range(limit_mb):
                    f.write(os.urandom(chunk_size))

            self._temp_files.append(temp_path)
            return DestructionResult(
                success=True,
                target="disk",
                action="exhaust_resources",
                message=f"Created {limit_mb}MB temp file at {temp_path}",
            )
        except OSError as e:
            return DestructionResult(
                success=True,
                target="disk",
                action="exhaust_resources",
                message=f"Disk exhaustion triggered: {e}",
            )

    def _exhaust_file_descriptors(self) -> DestructionResult:
        """Open many file descriptors to test FD limits."""
        opened_files: List = []
        count = 0
        try:
            for i in range(10000):
                f = open(os.devnull, "r")
                opened_files.append(f)
                count += 1
        except OSError:
            pass
        finally:
            for f in opened_files:
                f.close()

        return DestructionResult(
            success=True,
            target="file_descriptors",
            action="exhaust_resources",
            message=f"Opened and closed {count} file descriptors",
        )

    def cleanup(self) -> None:
        """Clean up any temporary files created during testing."""
        for path in self._temp_files:
            try:
                if os.path.exists(path):
                    os.remove(path)
                    parent = os.path.dirname(path)
                    if os.path.isdir(parent):
                        os.rmdir(parent)
            except OSError:
                pass
        self._temp_files.clear()
