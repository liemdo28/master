"""Exposed Port Scanner — Detect dangerously open ports."""
from __future__ import annotations

import socket
import subprocess
from dataclasses import dataclass
from typing import Any

DANGEROUS_PORTS = {
    21: "FTP — unencrypted file transfer",
    23: "Telnet — unencrypted remote access",
    25: "SMTP — mail relay (spam risk)",
    69: "TFTP — trivial file transfer (no auth)",
    135: "Windows RPC — lateral movement risk",
    139: "NetBIOS — network file sharing",
    445: "SMB — lateral movement, ransomware risk",
    1433: "MSSQL — database default port",
    1521: "Oracle DB — database default port",
    3306: "MySQL — database default port",
    3389: "RDP — remote desktop (brute-force risk)",
    5432: "PostgreSQL — database default port",
    5900: "VNC — unencrypted remote desktop",
    6379: "Redis — default (no auth risk)",
    27017: "MongoDB — default (no auth risk)",
    11211: "Memcached — default (amplification risk)",
    9200: "Elasticsearch — default (data exposure risk)",
    5984: "CouchDB — default (data exposure risk)",
    8080: "HTTP alt — debug/admin interfaces",
    8443: "HTTPS alt — debug/admin interfaces",
    27018: "MongoDB shard — database port",
    5672: "RabbitMQ — message broker default",
    15672: "RabbitMQ management — admin UI",
    9090: "Prometheus — metrics exposure",
    9093: "Alertmanager — alert config exposure",
    2375: "Docker — unauthenticated Docker API",
    2376: "Docker TLS — Docker daemon",
    5000: "Flask/Docker registry dev server",
    8888: "Jupyter/Notebook — code execution risk",
    4040: "Swagger UI — API documentation exposure",
}


@dataclass
class PortFinding:
    port: int
    protocol: str
    service: str
    state: str
    severity: str
    issue: str
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "port": self.port,
            "protocol": self.protocol,
            "service": self.service,
            "state": self.state,
            "severity": self.severity,
            "issue": self.issue,
            "recommendation": self.recommendation,
        }


class ExposedPortScanner:
    """Scan for dangerously exposed network ports."""

    def scan_ports(self, start: int = 1, end: int = 10000) -> list[PortFinding]:
        findings = []
        lsof_output = self._get_listening_ports()
        listening = set()
        for line in lsof_output.splitlines():
            parts = line.split()
            if len(parts) >= 9:
                try:
                    port = int(parts[8].split(":")[-1])
                    listening.add(port)
                except (ValueError, IndexError):
                    continue

        for port in sorted(listening):
            if port < start or port > end:
                continue
            if port in DANGEROUS_PORTS:
                severity = "critical" if port in {
                    23, 69, 445, 1433, 3306, 3389, 5432, 6379, 27017, 2375, 8888
                } else "high"
                findings.append(PortFinding(
                    port=port,
                    protocol="TCP",
                    service=f"Port {port}",
                    state="LISTEN",
                    severity=severity,
                    issue=DANGEROUS_PORTS[port],
                    recommendation=f"Close port {port} or restrict via firewall/ACL",
                ))

        return findings

    def _get_listening_ports(self) -> str:
        try:
            result = subprocess.run(
                ["lsof", "-i", "-P", "-n"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return result.stdout
        except Exception:
            return ""
