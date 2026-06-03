"""Environment Configuration Auditor."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class EnvFinding:
    key: str
    severity: str
    issue: str
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "severity": self.severity,
            "issue": self.issue,
            "recommendation": self.recommendation,
        }


DANGEROUS_KEYS = re.compile(r"(?i)(secret|key|password|token|credential|private|auth)", re.IGNORECASE)
DEBUG_FLAGS = re.compile(r"(?i)(debug|verbose|trace|log[_-]?level)\s*=", re.IGNORECASE)
LOCALHOST_EXPOSURE = re.compile(r"https?://(127\.|localhost|0\.0\.0\.0)", re.IGNORECASE)
HARDCODED_SENSITIVE = re.compile(r"(?i)(aws|google|azure|stripe|sendgrid|twilio|openai)\s*=", re.IGNORECASE)


class EnvAuditor:
    """Audit .env files for dangerous configurations."""

    def audit_env_file(self, env_path: Path | str) -> list[EnvFinding]:
        findings = []
        path = Path(env_path)
        if not path.exists():
            return findings

        for line_no, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            if "=" not in line:
                findings.append(EnvFinding(
                    key=f"line_{line_no}",
                    severity="low",
                    issue="Malformed environment variable (no '=' separator)",
                    recommendation="Ensure all variables use KEY=VALUE format",
                ))
                continue

            key = stripped.split("=", 1)[0]
            value = stripped.split("=", 1)[1].strip('"').strip("'")

            if not value or value == "your_key_here":
                if DANGEROUS_KEYS.search(key):
                    findings.append(EnvFinding(
                        key=key,
                        severity="medium",
                        issue="Dangerous key has empty or placeholder value",
                        recommendation=f"Set {key} to a real value or remove if unused",
                    ))
                continue

            if len(value) < 10 and DANGEROUS_KEYS.search(key):
                findings.append(EnvFinding(
                    key=key,
                    severity="high",
                    issue="Suspiciously short value for sensitive key",
                    recommendation="Sensitive keys should have full values, not short tokens",
                ))

            if DEBUG_FLAGS.search(line):
                findings.append(EnvFinding(
                    key=key,
                    severity="high",
                    issue="Debug/verbose flag enabled in environment",
                    recommendation="Disable debug flags in production environments",
                ))

            if LOCALHOST_EXPOSURE.search(value) and "localhost" not in key.lower():
                findings.append(EnvFinding(
                    key=key,
                    severity="medium",
                    issue="Localhost or 127.0.0.1 referenced in non-localhost context",
                    recommendation="Verify this is intentional; localhost references in production URLs are dangerous",
                ))

            if HARDCODED_SENSITIVE.search(line):
                findings.append(EnvFinding(
                    key=key,
                    severity="critical",
                    issue="Hardcoded credential/service key detected",
                    recommendation=f"Move {key} to secrets management (Vault, AWS Secrets Manager, etc.)",
                ))

        return findings
