"""Orphan Process Detector Module"""

import os
import subprocess
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class OrphanProcess:
    """Represents an orphan or zombie process."""
    pid: int
    name: str
    state: str  # "orphan", "zombie"
    parent_pid: int
    command: str
    cpu_time: Optional[str] = None


class OrphanDetector:
    """Detects orphan and zombie processes on the system."""

    def __init__(self):
        self._platform = os.uname().sysname.lower()

    def find_orphans(self) -> List[OrphanProcess]:
        """Find orphan processes (processes whose parent is init/launchd, PID 1)."""
        orphans: List[OrphanProcess] = []
        try:
            cmd = ["ps", "-eo", "pid,ppid,state,comm"]
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                return orphans

            lines = result.stdout.strip().split("\n")
            for line in lines[1:]:
                parts = line.split(None, 3)
                if len(parts) < 4:
                    continue
                try:
                    pid = int(parts[0])
                    ppid = int(parts[1])
                    state = parts[2]
                    command = parts[3].strip()

                    # Orphan: parent is PID 1 (init/launchd) but not a system process
                    if ppid == 1 and pid != 1:
                        # Filter out known system processes
                        if not self._is_system_process(command):
                            orphans.append(
                                OrphanProcess(
                                    pid=pid,
                                    name=os.path.basename(command.split()[0]),
                                    state="orphan",
                                    parent_pid=ppid,
                                    command=command,
                                )
                            )
                except (ValueError, IndexError):
                    continue
        except (subprocess.TimeoutExpired, OSError):
            pass
        return orphans

    def find_zombies(self) -> List[OrphanProcess]:
        """Find zombie processes (defunct processes)."""
        zombies: List[OrphanProcess] = []
        try:
            cmd = ["ps", "-eo", "pid,ppid,state,comm"]
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                return zombies

            lines = result.stdout.strip().split("\n")
            for line in lines[1:]:
                parts = line.split(None, 3)
                if len(parts) < 4:
                    continue
                try:
                    pid = int(parts[0])
                    ppid = int(parts[1])
                    state = parts[2]
                    command = parts[3].strip()

                    # Zombie state is 'Z' on Linux, 'Z' or 'Z+' on macOS
                    if state.startswith("Z"):
                        zombies.append(
                            OrphanProcess(
                                pid=pid,
                                name=os.path.basename(command.split()[0]),
                                state="zombie",
                                parent_pid=ppid,
                                command=command,
                            )
                        )
                except (ValueError, IndexError):
                    continue
        except (subprocess.TimeoutExpired, OSError):
            pass
        return zombies

    def cleanup_orphans(
        self, pids: Optional[List[int]] = None, signal_type: str = "TERM"
    ) -> List[int]:
        """Attempt to clean up orphan processes. Returns list of successfully signaled PIDs."""
        import signal as sig_module

        signal_map = {
            "TERM": sig_module.SIGTERM,
            "KILL": sig_module.SIGKILL,
            "INT": sig_module.SIGINT,
        }

        signal_to_send = signal_map.get(signal_type.upper(), sig_module.SIGTERM)
        cleaned: List[int] = []

        if pids is None:
            orphans = self.find_orphans()
            pids = [o.pid for o in orphans]

        for pid in pids:
            try:
                os.kill(pid, signal_to_send)
                cleaned.append(pid)
            except (ProcessLookupError, PermissionError, OSError):
                continue

        return cleaned

    def _is_system_process(self, command: str) -> bool:
        """Check if a command is a known system process."""
        system_prefixes = [
            "/usr/sbin/",
            "/usr/libexec/",
            "/System/",
            "/sbin/",
            "kernel_task",
            "launchd",
            "WindowServer",
            "loginwindow",
            "systemd",
        ]
        for prefix in system_prefixes:
            if command.startswith(prefix) or prefix in command:
                return True
        return False
