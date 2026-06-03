from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class ProcessInfo:
    pid: int
    command: str
    cpu_percent: float = 0.0
    port: int | None = None

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class ProcessInspector:
    def list_processes(self) -> list[ProcessInfo]:
        completed = subprocess.run(["ps", "-axo", "pid=,pcpu=,command="], capture_output=True, text=True, timeout=5, check=False)
        if completed.returncode != 0:
            return []
        processes = []
        for line in completed.stdout.splitlines():
            match = re.match(r"\s*(\d+)\s+([\d.]+)\s+(.*)", line)
            if not match:
                continue
            processes.append(ProcessInfo(int(match.group(1)), match.group(3), float(match.group(2))))
        return processes

    def occupied_ports(self) -> list[ProcessInfo]:
        completed = subprocess.run(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"], capture_output=True, text=True, timeout=5, check=False)
        if completed.returncode != 0:
            return []
        rows = []
        for line in completed.stdout.splitlines()[1:]:
            parts = line.split()
            if len(parts) < 9:
                continue
            port_match = re.search(r":(\d+)$", parts[8])
            if not port_match:
                continue
            rows.append(ProcessInfo(pid=int(parts[1]), command=parts[0], port=int(port_match.group(1))))
        return rows

    def detect_high_cpu(self, threshold: float = 80.0) -> list[ProcessInfo]:
        return [process for process in self.list_processes() if process.cpu_percent >= threshold]

    def detect_orphans(self) -> list[ProcessInfo]:
        markers = ["node", "vite", "next", "uvicorn", "flask", "pytest", "playwright"]
        return [process for process in self.list_processes() if any(marker in process.command.lower() for marker in markers)]
