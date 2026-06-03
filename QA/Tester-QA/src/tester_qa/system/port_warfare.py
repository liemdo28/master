"""Port Warfare Module"""

import socket
import subprocess
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class PortConflict:
    """Represents a port conflict."""
    port: int
    processes: List[str]
    protocol: str  # "tcp" or "udp"


@dataclass
class PortStatus:
    """Status of a port."""
    port: int
    is_open: bool
    protocol: str
    process_name: Optional[str] = None
    pid: Optional[int] = None


class PortWarfare:
    """Port conflict testing and management."""

    def __init__(self):
        self._occupied_sockets: Dict[int, socket.socket] = {}
        self._platform = os.uname().sysname.lower()

    def find_port_conflicts(self, ports: Optional[List[int]] = None) -> List[PortConflict]:
        """Find port conflicts on the system."""
        conflicts: List[PortConflict] = []
        port_usage: Dict[int, List[str]] = {}

        try:
            if self._platform == "darwin":
                cmd = ["lsof", "-i", "-P", "-n"]
            else:
                cmd = ["lsof", "-i", "-P", "-n"]

            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                return conflicts

            lines = result.stdout.strip().split("\n")
            for line in lines[1:]:
                parts = line.split()
                if len(parts) < 9:
                    continue
                name = parts[0]
                # Extract port from address field
                addr_field = parts[8] if len(parts) > 8 else ""
                if ":" in addr_field:
                    try:
                        port_str = addr_field.rsplit(":", 1)[-1]
                        port = int(port_str)
                        if ports is None or port in ports:
                            if port not in port_usage:
                                port_usage[port] = []
                            if name not in port_usage[port]:
                                port_usage[port].append(name)
                    except ValueError:
                        continue
        except (subprocess.TimeoutExpired, OSError):
            pass

        # Conflicts are ports used by multiple processes
        for port, procs in port_usage.items():
            if len(procs) > 1:
                conflicts.append(
                    PortConflict(port=port, processes=procs, protocol="tcp")
                )

        return conflicts

    def occupy_port(self, port: int, protocol: str = "tcp") -> bool:
        """Occupy a port for testing purposes."""
        if port in self._occupied_sockets:
            return True  # Already occupied by us

        try:
            if protocol == "tcp":
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind(("127.0.0.1", port))
                sock.listen(1)
            else:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind(("127.0.0.1", port))

            self._occupied_sockets[port] = sock
            return True
        except OSError:
            return False

    def release_port(self, port: int) -> bool:
        """Release a previously occupied port."""
        if port not in self._occupied_sockets:
            return False

        try:
            self._occupied_sockets[port].close()
            del self._occupied_sockets[port]
            return True
        except OSError:
            return False

    def release_all(self) -> None:
        """Release all occupied ports."""
        for port in list(self._occupied_sockets.keys()):
            self.release_port(port)

    def scan_port_range(
        self, start_port: int, end_port: int, host: str = "127.0.0.1"
    ) -> List[PortStatus]:
        """Scan a range of ports and return their status."""
        results: List[PortStatus] = []

        for port in range(start_port, end_port + 1):
            is_open = self._check_port_open(host, port)
            status = PortStatus(
                port=port,
                is_open=is_open,
                protocol="tcp",
            )
            results.append(status)

        return results

    def _check_port_open(self, host: str, port: int) -> bool:
        """Check if a port is open (in use)."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        try:
            result = sock.connect_ex((host, port))
            return result == 0
        except (OSError, socket.timeout):
            return False
        finally:
            sock.close()

    def __del__(self) -> None:
        """Cleanup occupied sockets on destruction."""
        self.release_all()
