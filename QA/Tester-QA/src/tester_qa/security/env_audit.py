"""Environment configuration auditor for detecting unsafe settings."""

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class EnvFinding:
    """Represents an unsafe environment configuration finding."""

    file_path: str
    key: str
    value: str
    issue: str
    severity: str = "medium"
    recommendation: str = ""

    def __str__(self) -> str:
        return (
            f"[{self.severity.upper()}] {self.issue} - "
            f"{self.key} in {self.file_path}: {self.recommendation}"
        )


class EnvAuditor:
    """Audits .env files and environment configs for unsafe settings."""

    DEBUG_FLAGS: Set[str] = {
        "DEBUG", "APP_DEBUG", "FLASK_DEBUG", "DJANGO_DEBUG",
        "NODE_ENV_DEBUG", "VERBOSE", "TRACE", "DEV_MODE",
    }

    UNSAFE_PRODUCTION_VALUES: Dict[str, List[str]] = {
        "DEBUG": ["true", "1", "yes", "on"],
        "APP_DEBUG": ["true", "1", "yes", "on"],
        "FLASK_DEBUG": ["true", "1", "yes", "on"],
        "DJANGO_DEBUG": ["true", "1", "yes", "on"],
        "NODE_ENV": ["development", "dev", "test"],
        "ENVIRONMENT": ["development", "dev", "local"],
        "LOG_LEVEL": ["debug", "trace", "verbose"],
    }

    SENSITIVE_KEYS: Set[str] = {
        "SECRET_KEY", "API_KEY", "API_SECRET", "DATABASE_URL",
        "DB_PASSWORD", "AWS_SECRET_ACCESS_KEY", "PRIVATE_KEY",
        "JWT_SECRET", "ENCRYPTION_KEY", "AUTH_TOKEN",
        "SMTP_PASSWORD", "REDIS_PASSWORD", "MONGO_PASSWORD",
    }

    PLACEHOLDER_VALUES: Set[str] = {
        "changeme", "password", "secret", "your-secret-here",
        "replace-me", "todo", "fixme", "xxx", "placeholder",
        "example", "test", "default",
    }

    def __init__(self) -> None:
        """Initialize the environment auditor."""
        self._findings: List[EnvFinding] = []

    def audit_env_file(self, file_path: str) -> List[EnvFinding]:
        """Audit a .env file for unsafe configurations.

        Args:
            file_path: Path to the .env file to audit.

        Returns:
            List of EnvFinding instances representing issues found.
        """
        findings: List[EnvFinding] = []
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            return findings

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings

        lines = content.splitlines()
        for line in lines:
            line = line.strip()

            if not line or line.startswith("#"):
                continue

            parsed = self._parse_env_line(line)
            if parsed is None:
                continue

            key, value = parsed

            # Check for empty sensitive values
            if key.upper() in self.SENSITIVE_KEYS and not value:
                findings.append(EnvFinding(
                    file_path=str(path.resolve()),
                    key=key,
                    value="<empty>",
                    issue="Empty sensitive value",
                    severity="high",
                    recommendation=f"Set a proper value for {key}",
                ))

            # Check for placeholder values
            if value.lower() in self.PLACEHOLDER_VALUES:
                findings.append(EnvFinding(
                    file_path=str(path.resolve()),
                    key=key,
                    value=value,
                    issue="Placeholder value detected",
                    severity="high" if key.upper() in self.SENSITIVE_KEYS else "medium",
                    recommendation=f"Replace placeholder value for {key} with actual credential",
                ))

            # Check for unsafe production values
            if key.upper() in self.UNSAFE_PRODUCTION_VALUES:
                unsafe_values = self.UNSAFE_PRODUCTION_VALUES[key.upper()]
                if value.lower() in unsafe_values:
                    findings.append(EnvFinding(
                        file_path=str(path.resolve()),
                        key=key,
                        value=value,
                        issue="Potentially unsafe production value",
                        severity="medium",
                        recommendation=f"Ensure {key}={value} is not used in production",
                    ))

            # Check for hardcoded localhost/development URLs
            if self._is_dev_url(value):
                findings.append(EnvFinding(
                    file_path=str(path.resolve()),
                    key=key,
                    value=value,
                    issue="Development URL detected",
                    severity="low",
                    recommendation=f"Verify {key} points to correct environment URL",
                ))

        self._findings.extend(findings)
        return findings

    def check_production_safety(self, file_path: str) -> List[EnvFinding]:
        """Check if an env file is safe for production use.

        Args:
            file_path: Path to the .env file to check.

        Returns:
            List of findings that would be unsafe in production.
        """
        findings: List[EnvFinding] = []
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            return findings

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings

        lines = content.splitlines()
        env_vars: Dict[str, str] = {}

        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parsed = self._parse_env_line(line)
            if parsed:
                env_vars[parsed[0]] = parsed[1]

        # Check debug flags are disabled
        for key, value in env_vars.items():
            if key.upper() in self.DEBUG_FLAGS:
                if value.lower() in ("true", "1", "yes", "on"):
                    findings.append(EnvFinding(
                        file_path=str(path.resolve()),
                        key=key,
                        value=value,
                        issue="Debug flag enabled in production config",
                        severity="critical",
                        recommendation=f"Disable {key} for production deployment",
                    ))

        # Check for missing required production vars
        required_prod_keys = {"SECRET_KEY", "DATABASE_URL"}
        for req_key in required_prod_keys:
            if req_key not in env_vars and req_key.lower() not in env_vars:
                findings.append(EnvFinding(
                    file_path=str(path.resolve()),
                    key=req_key,
                    value="<missing>",
                    issue="Required production variable missing",
                    severity="high",
                    recommendation=f"Add {req_key} to production configuration",
                ))

        # Check HTTPS enforcement
        for key, value in env_vars.items():
            if "url" in key.lower() or "endpoint" in key.lower():
                if value.startswith("http://") and "localhost" not in value:
                    findings.append(EnvFinding(
                        file_path=str(path.resolve()),
                        key=key,
                        value=value,
                        issue="Non-HTTPS URL in production config",
                        severity="high",
                        recommendation=f"Use HTTPS for {key} in production",
                    ))

        self._findings.extend(findings)
        return findings

    def find_debug_flags(self, file_path: str) -> List[Tuple[str, str]]:
        """Find all debug-related flags in an env file.

        Args:
            file_path: Path to the .env file to scan.

        Returns:
            List of (key, value) tuples for debug-related settings.
        """
        debug_flags: List[Tuple[str, str]] = []
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            return debug_flags

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return debug_flags

        lines = content.splitlines()
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            parsed = self._parse_env_line(line)
            if parsed is None:
                continue

            key, value = parsed
            if key.upper() in self.DEBUG_FLAGS:
                debug_flags.append((key, value))
            elif "debug" in key.lower() or "verbose" in key.lower():
                debug_flags.append((key, value))

        return debug_flags

    def _parse_env_line(self, line: str) -> Optional[Tuple[str, str]]:
        """Parse a single .env file line into key-value pair."""
        if "=" not in line:
            return None

        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()

        # Remove surrounding quotes
        if len(value) >= 2 and value[0] in ('"', "'") and value[-1] == value[0]:
            value = value[1:-1]

        return (key, value)

    def _is_dev_url(self, value: str) -> bool:
        """Check if a value looks like a development URL."""
        dev_indicators = [
            "localhost", "127.0.0.1", "0.0.0.0",
            ":3000", ":5000", ":8000", ":8080", ":9000",
        ]
        for indicator in dev_indicators:
            if indicator in value:
                return True
        return False
