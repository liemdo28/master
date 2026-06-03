"""Process Explosion Module"""

import multiprocessing
import os
import resource
import subprocess
import time
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ForkBombResult:
    """Result of a fork bomb test."""
    child_count: int
    max_processes: int
    process_limit: int
    cleanup_success: bool
    duration_seconds: float
    message: str


@dataclass
class ProcessLimitInfo:
    """Information about process limits."""
    soft_limit: int
    hard_limit: int
    current_processes: int


class ProcessExplosion:
    """Tests process creation limits and cleanup behavior."""

    def __init__(self):
        self._platform = os.uname().sysname.lower()
        self._child_pids: List[int] = []

    def controlled_fork_bomb(
        self, max_children: int = 10, delay_seconds: float = 0.1
    ) -> ForkBombResult:
        """Execute a controlled fork bomb that creates limited child processes."""
        start_time = time.time()
        cleanup_success = True

        # Get current process limit
        soft, hard = resource.getrlimit(resource.RLIMIT_NPROC)
        process_limit = soft

        # Count current processes
        try:
            ps_result = subprocess.run(
                ["ps", "-o", "pid=", "-U", str(os.getuid())],
                capture_output=True,
                text=True,
                timeout=5,
            )
            current_count = len(ps_result.stdout.strip().split())
        except (subprocess.TimeoutExpired, OSError):
            current_count = 1

        # Create child processes safely
        created_count = 0
        for i in range(max_children):
            try:
                pid = os.fork()
                if pid == 0:
                    # Child process - wait briefly then exit
                    time.sleep(delay_seconds)
                    os._exit(0)
                elif pid > 0:
                    # Parent - record child PID
                    self._child_pids.append(pid)
                    created_count += 1
            except OSError:
                break

        # Wait for children to complete
        time.sleep(delay_seconds * 2)

        # Clean up any remaining children
        for child_pid in self._child_pids:
            try:
                os.waitpid(child_pid, os.WNOHANG)
            except (ProcessLookupError, ChildProcessError):
                pass

        # Final cleanup
        for child_pid in self._child_pids:
            try:
                os.kill(child_pid, 9)
            except (ProcessLookupError, PermissionError):
                pass

        self._child_pids.clear()
        duration = time.time() - start_time

        return ForkBombResult(
            child_count=created_count,
            max_processes=current_count + created_count,
            process_limit=process_limit,
            cleanup_success=cleanup_success,
            duration_seconds=duration,
            message=f"Created {created_count} child processes, "
            f"limit is {process_limit}",
        )

    def measure_process_limit(self) -> ProcessLimitInfo:
        """Measure the system's process limit."""
        soft, hard = resource.getrlimit(resource.RLIMIT_NPROC)

        try:
            ps_result = subprocess.run(
                ["ps", "-o", "pid=", "-U", str(os.getuid())],
                capture_output=True,
                text=True,
                timeout=5,
            )
            current = len(ps_result.stdout.strip().split())
        except (subprocess.TimeoutExpired, OSError):
            current = 0

        return ProcessLimitInfo(
            soft_limit=soft,
            hard_limit=hard,
            current_processes=current,
        )

    def test_process_cleanup(
        self, num_processes: int = 5, cleanup_delay: float = 1.0
    ) -> bool:
        """Test that spawned processes are properly cleaned up."""
        pids: List[int] = []
        success = True

        # Spawn processes
        for _ in range(num_processes):
            try:
                pid = os.fork()
                if pid == 0:
                    # Child - sleep then exit
                    time.sleep(cleanup_delay)
                    os._exit(0)
                elif pid > 0:
                    pids.append(pid)
            except OSError:
                success = False
                break

        # Wait for cleanup period plus buffer
        time.sleep(cleanup_delay + 0.5)

        # Check if processes were cleaned up
        for pid in pids:
            try:
                result = os.waitpid(pid, os.WNOHANG)
                if result[0] == 0:
                    # Process still exists
                    success = False
                    # Force kill it
                    try:
                        os.kill(pid, 9)
                    except (ProcessLookupError, PermissionError):
                        pass
            except ChildProcessError:
                pass

        return success

    def set_process_limit(self, limit: int) -> bool:
        """Attempt to set a new process limit (soft limit)."""
        try:
            resource.setrlimit(resource.RLIMIT_NPROC, (limit, resource.RLIM_INFINITY))
            return True
        except (ValueError, OSError):
            return False

    def get_cpu_count(self) -> int:
        """Get the number of CPU cores available."""
        return multiprocessing.cpu_count()
