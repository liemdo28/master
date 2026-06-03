"""Exposed port scanner for finding insecurely exposed ports and services."""

import re
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class ExposedPortFinding:
    """Represents a discovered exposed port or service."""

    host: str
    port: int
    service: str
    issue: str
    severity: str
    recommendation: str = ""

    def __str__(self) -> str:
        return (
            f"[{self.severity.upper()}] {self.issue} - "
            f"{self.host}:{self.port} ({self.service}): {self.recommendation}"
        )


class ExposedPortScanner:
    """Finds exposed ports and services in configuration and running processes."""

    DEBUG_PORTS: Set[int] = {
        5858, 5859,  # Node.js debugger
        9229, 9333,  # Chrome DevTools
        5678,  # Debug port
        5005,  # Java debugging
        8787,  # R debugger
        56789,  # Custom debug
    }

    DEBUG_PORT_PATTERNS: Dict[str, int] = {
        "node": 9229,
        "nodemon": 5858,
        "python": 5678,
        "java": 5005,
        "ruby": 8787,
        "debug": 5858,
    }

    INSECURE_SERVICES: Set[str] = {
        "ftp", "telnet", "rsh", "rlogin", "finger",
        "http", "http-alt", "memcached", "mongodb",
        "redis", "elasticsearch", "kafka",
    }

    CONFIG_PORT_PATTERNS: List[str] = [
        r'(?:listen|host|bind|address|port|server)\s*[=:]\s*["\']?(\d+)["\']?',
        r'PORT[=\s]+(\d+)',
        r':(\d{4,5})\b',
        r'localhost:(\d+)',
        r'0\.0\.0\.0:(\d+)',
    ]

    def __init__(self) -> None:
        """Initialize the exposed port scanner."""
        self._findings: List[ExposedPortFinding] = []

    def scan_ports(
        self,
        host: str = "localhost",
        ports: Optional[List[int]] = None,
        timeout: float = 1.0,
    ) -> List[ExposedPortFinding]:
        """Scan specified ports on a host for exposure.

        Args:
            host: Hostname or IP to scan.
            ports: List of ports to scan. If None, scans common ports.
            timeout: Connection timeout in seconds.

        Returns:
            List of ExposedPortFinding instances for open ports found.
        """
        findings: List[ExposedPortFinding] = []

        if ports is None:
            ports = self._get_common_ports()

        for port in ports:
            if self._is_port_open(host, port, timeout):
                service = self._identify_service(port)
                issues = self._analyze_port_issues(port, service)

                for issue, severity, recommendation in issues:
                    findings.append(ExposedPortFinding(
                        host=host,
                        port=port,
                        service=service,
                        issue=issue,
                        severity=severity,
                        recommendation=recommendation,
                    ))

        self._findings.extend(findings)
        return findings

    def check_localhost_tunnels(self, file_path: str) -> List[ExposedPortFinding]:
        """Check configuration files for localhost tunnel configurations.

        Args:
            file_path: Path to configuration file to scan.

        Returns:
            List of ExposedPortFinding instances for tunnel configurations.
        """
        findings: List[ExposedPortFinding] = []
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            return findings

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings

        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._check_tunnel_patterns(
                str(path.resolve()), line_number, line
            )
            findings.extend(line_findings)

        self._findings.extend(findings)
        return findings

    def find_debug_ports(self, file_path: str) -> List[ExposedPortFinding]:
        """Find debug port configurations in source files.

        Args:
            file_path: Path to the file to scan.

        Returns:
            List of ExposedPortFinding instances for debug port configurations.
        """
        findings: List[ExposedPortFinding] = []
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            return findings

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings

        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._check_debug_port_patterns(
                str(path.resolve()), line_number, line
            )
            findings.extend(line_findings)

        self._findings.extend(findings)
        return findings

    def _is_port_open(self, host: str, port: int, timeout: float) -> bool:
        """Check if a port is open on a host."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        try:
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except (socket.error, OSError):
            return False

    def _get_common_ports(self) -> List[int]:
        """Return list of commonly monitored ports."""
        return [
            21, 22, 23, 25, 80, 110, 143, 443, 445,
            993, 995, 1433, 1521, 3306, 3389, 5432,
            5900, 6379, 8080, 8443, 9200, 27017,
        ]

    def _identify_service(self, port: int) -> str:
        """Identify common service name for a port."""
        service_map: Dict[int, str] = {
            20: "ftp-data",
            21: "ftp",
            22: "ssh",
            23: "telnet",
            25: "smtp",
            53: "dns",
            80: "http",
            110: "pop3",
            143: "imap",
            443: "https",
            445: "smb",
            993: "imaps",
            995: "pop3s",
            1433: "mssql",
            1521: "oracle",
            3306: "mysql",
            3389: "rdp",
            5432: "postgres",
            5900: "vnc",
            6379: "redis",
            8080: "http-proxy",
            8443: "https-alt",
            9200: "elasticsearch",
            27017: "mongodb",
            5858: "node-debug",
            9229: "chrome-devtools",
        }
        return service_map.get(port, "unknown")

    def _analyze_port_issues(
        self,
        port: int,
        service: str,
    ) -> List[Tuple[str, str, str]]:
        """Analyze an open port for security issues."""
        issues: List[Tuple[str, str, str]] = []

        # Check for debug ports
        if port in self.DEBUG_PORTS:
            issues.append((
                "Debug port exposed",
                "critical",
                f"Debug port {port} is open. Disable debugging in production.",
            ))

        # Check for insecure services
        if service in self.INSECURE_SERVICES:
            issues.append((
                f"Insecure service: {service}",
                "high",
                f"{service} service is exposed. Consider using secure alternatives.",
            ))

        # Check for commonly misconfigured ports
        if service == "http" and port not in [80, 8080]:
            issues.append((
                "Non-standard HTTP port",
                "low",
                "Non-standard HTTP port detected. Ensure proper firewall rules.",
            ))

        # Check for database ports on non-standard hosts
        db_ports = {1433, 1521, 3306, 5432, 27017}
        if port in db_ports:
            issues.append((
                "Database port accessible",
                "high",
                f"Database port {port} is exposed. Restrict access to authorized hosts only.",
            ))

        return issues

    def _check_tunnel_patterns(
        self,
        file_path: str,
        line_number: int,
        line: str,
    ) -> List[ExposedPortFinding]:
        """Check for localhost tunnel patterns in a line."""
        findings: List[ExposedPortFinding] = []
        lower_line = line.lower()

        tunnel_patterns = [
            (r'localhost:(\d+)', "localhost tunnel"),
            (r'127\.0\.0\.1:(\d+)', "localhost tunnel"),
            (r'0\.0\.0\.0:(\d+)', "all interfaces binding"),
            (r'::1:(\d+)', "IPv6 localhost tunnel"),
        ]

        for pattern, tunnel_type in tunnel_patterns:
            match = re.search(pattern, lower_line)
            if match:
                port = int(match.group(1))
                service = self._identify_service(port)

                severity = "medium"
                if tunnel_type == "all interfaces binding":
                    severity = "high"
                    if service in self.INSECURE_SERVICES or port in self.DEBUG_PORTS:
                        severity = "critical"

                findings.append(ExposedPortFinding(
                    host="config",
                    port=port,
                    service=service,
                    issue=f"{tunnel_type} configuration found in code",
                    severity=severity,
                    recommendation=self._get_tunnel_recommendation(tunnel_type, port),
                ))

        return findings

    def _check_debug_port_patterns(
        self,
        file_path: str,
        line_number: int,
        line: str,
    ) -> List[ExposedPortFinding]:
        """Check for debug port patterns in source files."""
        findings: List[ExposedPortFinding] = []

        debug_indicators = [
            "debug", "inspect", "debugger", "inspector",
            "NODE_OPTIONS", "JAVA_TOOL_OPTIONS", "PYTHONDEBUG",
        ]

        has_debug_indicator = any(ind.lower() in line.lower() for ind in debug_indicators)

        if has_debug_indicator:
            for port_match in re.finditer(r'\b(\d{4,5})\b', line):
                port = int(port_match.group(1))
                if port in self.DEBUG_PORTS:
                    findings.append(ExposedPortFinding(
                        host="config",
                        port=port,
                        service=self._identify_service(port),
                        issue="Debug port configuration detected",
                        severity="critical",
                        recommendation=f"Debug port {port} found in configuration. Disable in production.",
                    ))

        return findings

    def _get_tunnel_recommendation(self, tunnel_type: str, port: int) -> str:
        """Get recommendation for a tunnel configuration."""
        recommendations = {
            "localhost tunnel": (
                "Localhost tunnel is typically safe for development. "
                "Ensure it is not exposed externally."
            ),
            "all interfaces binding": (
                "Binding to 0.0.0.0 exposes the port on all network interfaces. "
                "Bind to 127.0.0.1 or specific interfaces for better security."
            ),
            "IPv6 localhost tunnel": (
                "IPv6 localhost tunnel detected. Ensure consistent security policy "
                "with IPv4 configuration."
            ),
        }
        base = recommendations.get(tunnel_type, "Review tunnel configuration security.")
        if port in self.DEBUG_PORTS:
            base += f" Debug port {port} should be disabled in production."
        return base
