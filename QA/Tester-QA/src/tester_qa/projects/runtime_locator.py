"""Detect running services, ports, and runtime environments for projects."""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class RuntimeInstance:
    name: str
    port: int | None = None
    protocol: str = "http"  # http | https | ws | wss
    pid: int | None = None
    status: str = "unknown"  # running | stopped | unknown
    url: str | None = None
    source: str = "config"  # config | process | docker

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "port": self.port,
            "protocol": self.protocol,
            "pid": self.pid,
            "status": self.status,
            "url": self.url,
            "source": self.source,
        }


class RuntimeLocator:
    """Locate running services and configured runtimes for a project."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path).expanduser().resolve()

    def locate(self) -> list[RuntimeInstance]:
        """Find all runtime instances for this project."""
        instances: list[RuntimeInstance] = []
        instances.extend(self._from_package_json())
        instances.extend(self._from_docker_compose())
        instances.extend(self._from_env_files())
        instances.extend(self._from_running_processes())
        return instances

    def _from_package_json(self) -> list[RuntimeInstance]:
        """Extract port info from package.json scripts."""
        instances: list[RuntimeInstance] = []
        pkg_json = self.path / "package.json"
        if not pkg_json.exists():
            return instances

        try:
            data = json.loads(pkg_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return instances

        scripts = data.get("scripts", {})
        for script_name, command in scripts.items():
            port = self._extract_port_from_command(command)
            if port and script_name in ("dev", "start", "serve"):
                instances.append(RuntimeInstance(
                    name=f"{data.get('name', self.path.name)}:{script_name}",
                    port=port,
                    protocol="http",
                    source="config",
                    url=f"http://localhost:{port}",
                ))

        # Default ports for known frameworks
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        if "next" in deps and not any(i.port == 3000 for i in instances):
            instances.append(RuntimeInstance(
                name=f"{data.get('name', self.path.name)}:next",
                port=3000,
                protocol="http",
                source="config",
                url="http://localhost:3000",
            ))
        if "vite" in deps and not any(i.port == 5173 for i in instances):
            instances.append(RuntimeInstance(
                name=f"{data.get('name', self.path.name)}:vite",
                port=5173,
                protocol="http",
                source="config",
                url="http://localhost:5173",
            ))

        return instances

    def _from_docker_compose(self) -> list[RuntimeInstance]:
        """Extract services and ports from docker-compose."""
        instances: list[RuntimeInstance] = []
        for compose_name in ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]:
            compose_path = self.path / compose_name
            if not compose_path.exists():
                continue
            try:
                text = compose_path.read_text(encoding="utf-8")
                # Simple port extraction from YAML (avoid heavy yaml dependency)
                current_service: str | None = None
                in_ports = False
                for line in text.splitlines():
                    stripped = line.strip()
                    # Detect service names (top-level keys under services:)
                    if not line.startswith(" ") and not line.startswith("\t") and stripped.endswith(":"):
                        continue
                    if line.startswith("  ") and not line.startswith("    ") and stripped.endswith(":"):
                        current_service = stripped.rstrip(":")
                        in_ports = False
                    elif "ports:" in stripped:
                        in_ports = True
                    elif in_ports and stripped.startswith("-"):
                        port_str = stripped.lstrip("- ").strip("'\"")
                        host_port = self._parse_docker_port(port_str)
                        if host_port and current_service:
                            instances.append(RuntimeInstance(
                                name=f"docker:{current_service}",
                                port=host_port,
                                protocol="http",
                                source="docker",
                                url=f"http://localhost:{host_port}",
                            ))
                    elif in_ports and not stripped.startswith("-"):
                        in_ports = False
            except OSError:
                pass

        return instances

    def _from_env_files(self) -> list[RuntimeInstance]:
        """Extract port configurations from .env files."""
        instances: list[RuntimeInstance] = []
        env_files = [".env", ".env.local", ".env.development"]
        for env_name in env_files:
            env_path = self.path / env_name
            if not env_path.exists():
                continue
            try:
                for line in env_path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "PORT" in line.upper() and "=" in line:
                        key, _, value = line.partition("=")
                        value = value.strip().strip("'\"")
                        try:
                            port = int(value)
                            instances.append(RuntimeInstance(
                                name=f"env:{key.strip()}",
                                port=port,
                                protocol="http",
                                source="config",
                                url=f"http://localhost:{port}",
                            ))
                        except ValueError:
                            pass
            except OSError:
                pass

        return instances

    def _from_running_processes(self) -> list[RuntimeInstance]:
        """Check for actually running processes in the project directory."""
        instances: list[RuntimeInstance] = []
        try:
            result = subprocess.run(
                ["lsof", "-iTCP", "-sTCP:LISTEN", "-nP"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                project_str = str(self.path)
                for line in result.stdout.splitlines()[1:]:  # skip header
                    parts = line.split()
                    if len(parts) >= 9:
                        pid = int(parts[1]) if parts[1].isdigit() else None
                        port_info = parts[8]
                        if ":" in port_info:
                            port_str = port_info.rsplit(":", 1)[-1]
                            try:
                                port = int(port_str)
                                # Check if this process is related to our project
                                if pid:
                                    cwd = self._get_process_cwd(pid)
                                    if cwd and project_str in cwd:
                                        instances.append(RuntimeInstance(
                                            name=f"process:{parts[0]}",
                                            port=port,
                                            pid=pid,
                                            status="running",
                                            source="process",
                                            url=f"http://localhost:{port}",
                                        ))
                            except ValueError:
                                pass
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            pass

        return instances

    def _extract_port_from_command(self, command: str) -> int | None:
        """Extract port number from a shell command string."""
        import re
        # Match patterns like --port 3000, -p 3000, PORT=3000
        patterns = [
            r"--port[= ](\d+)",
            r"-p[= ](\d+)",
            r"PORT=(\d+)",
            r":(\d{4,5})",
        ]
        for pattern in patterns:
            match = re.search(pattern, command)
            if match:
                return int(match.group(1))
        return None

    def _parse_docker_port(self, port_str: str) -> int | None:
        """Parse docker port mapping like '8080:80' or '3000'."""
        if ":" in port_str:
            host_part = port_str.split(":")[0]
            try:
                return int(host_part)
            except ValueError:
                # Could be IP:port:container_port
                parts = port_str.split(":")
                if len(parts) >= 2:
                    try:
                        return int(parts[-2])
                    except ValueError:
                        pass
        else:
            try:
                return int(port_str.split("/")[0])
            except ValueError:
                pass
        return None

    def _get_process_cwd(self, pid: int) -> str | None:
        """Get the working directory of a process."""
        try:
            result = subprocess.run(
                ["lsof", "-p", str(pid), "-Fn"],
                capture_output=True, text=True, timeout=3,
            )
            for line in result.stdout.splitlines():
                if line.startswith("n") and line[1] == "/":
                    return line[1:]
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            pass
        return None
