"""Process Control Module"""

import os
import subprocess
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ProcessInfo:
    """Information about a running process."""
    pid: int
    name: str
    command: str
    cpu_percent: Optional[float] = None
    memory_mb: Optional[float] = None
    parent_pid: Optional[int] = None
    children: List[int] = field(default_factory=list)


class ProcessController:
    """Manages and monitors system processes."""

    def __init__(self):
        self._platform = os.uname().sysname.lower()

    def list_processes(self, filter_user: Optional[str] = None) -> List[ProcessInfo]:
        """List all running processes, optionally filtered by user."""
        processes: List[ProcessInfo] = []
        try:
            if self._platform == "darwin" or self._platform == "linux":
                cmd = ["ps", "aux"]
                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=10
                )
                if result.returncode != 0:
                    return processes

                lines = result.stdout.strip().split("\n")
                for line in lines[1:]:  # Skip header
                    parts = line.split(None, 10)
                    if len(parts) < 11:
                        continue
                    user = parts[0]
                    if filter_user and user != filter_user:
                        continue
                    try:
                        pid = int(parts[1])
                        cpu = float(parts[2])
                        mem_percent = float(parts[3])
                        command = parts[10]
                        name = os.path.basename(command.split()[0]) if command else ""
                        processes.append(
                            ProcessInfo(
                                pid=pid,
                                name=name,
                                command=command,
                                cpu_percent=cpu,
                                memory_mb=mem_percent,
                            )
                        )
                    except (ValueError, IndexError):
                        continue
        except (subprocess.TimeoutExpired, OSError):
            pass
        return processes

    def find_by_name(self, name: str) -> List[ProcessInfo]:
        """Find processes by name (partial match)."""
        all_procs = self.list_processes()
        name_lower = name.lower()
        return [
            p for p in all_procs
            if name_lower in p.name.lower() or name_lower in p.command.lower()
        ]

    def find_by_port(self, port: int) -> List[ProcessInfo]:
        """Find processes listening on a specific port."""
        processes: List[ProcessInfo] = []
        try:
            if self._platform == "darwin":
                cmd = ["lsof", "-i", f":{port}", "-P", "-n"]
            else:
                cmd = ["lsof", "-i", f":{port}", "-P", "-n"]

            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                return processes

            lines = result.stdout.strip().split("\n")
            for line in lines[1:]:  # Skip header
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        name = parts[0]
                        pid = int(parts[1])
                        command = " ".join(parts[7:]) if len(parts) > 7 else name
                        processes.append(
                            ProcessInfo(
                                pid=pid,
                                name=name,
                                command=command,
                            )
                        )
                    except (ValueError, IndexError):
                        continue
        except (subprocess.TimeoutExpired, OSError):
            pass
        return processes

    def get_process_tree(self, pid: Optional[int] = None) -> Dict[int, ProcessInfo]:
        """Get the process tree, optionally rooted at a specific PID."""
        tree: Dict[int, ProcessInfo] = {}
        try:
            if self._platform == "darwin" or self._platform == "linux":
                cmd = ["ps", "-eo", "pid,ppid,comm"]
                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=10
                )
                if result.returncode != 0:
                    return tree

                lines = result.stdout.strip().split("\n")
                for line in lines[1:]:
                    parts = line.split(None, 2)
                    if len(parts) < 3:
                        continue
                    try:
                        proc_pid = int(parts[0])
                        ppid = int(parts[1])
                        name = parts[2].strip()
                        tree[proc_pid] = ProcessInfo(
                            pid=proc_pid,
                            name=name,
                            command=name,
                            parent_pid=ppid,
                        )
                    except (ValueError, IndexError):
                        continue

                # Build children lists
                for proc_pid, info in tree.items():
                    if info.parent_pid is not None and info.parent_pid in tree:
                        tree[info.parent_pid].children.append(proc_pid)

                # Filter to subtree if pid specified
                if pid is not None and pid in tree:
                    subtree: Dict[int, ProcessInfo] = {}
                    queue = [pid]
                    while queue:
                        current = queue.pop(0)
                        if current in tree:
                            subtree[current] = tree[current]
                            queue.extend(tree[current].children)
                    return subtree

        except (subprocess.TimeoutExpired, OSError):
            pass
        return tree
