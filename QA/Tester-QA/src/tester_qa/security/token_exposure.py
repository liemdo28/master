"""Token exposure detector for finding exposed tokens in logs, responses, and URLs."""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Pattern, Tuple


@dataclass
class TokenExposureFinding:
    """Represents an exposed token or sensitive data finding."""

    file_path: str
    line_number: int
    token_type: str
    exposed_text: str
    severity: str
    description: str
    recommendation: str = ""

    def __str__(self) -> str:
        return (
            f"[{self.severity.upper()}] {self.token_type} exposure in "
            f"{self.file_path}:{self.line_number}: {self.description}"
        )


class TokenExposureDetector:
    """Finds exposed tokens in logs, responses, and URLs."""

    TOKEN_PATTERNS: Dict[str, Pattern[str]] = {
        "kub": re.compile(r"AKIA[0-9A-Z]{16}"),
        "jwt": re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*"),
        "github_token": re.compile(r"ghp_[A-Za-z0-9]{36}"),
        "github_oauth": re.compile(r"gho_[A-Za-z0-9]{36}"),
        "slack_token": re.compile(r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,32}"),
        "aws_access_key": re.compile(r"AKIA[0-9A-Z]{16}"),
        "aws_secret_key": re.compile(r"(?i)aws_secret_access_key\s*[=: ]\s*[A-Za-z0-9/+=]{40}"),
        "google_api_key": re.compile(r"AIza[0-9A-Za-z_\-]{35}"),
        "paypal_api_key": re.compile(r"acc[_a-z0-9]{22}"),
    }

    def __init__(self) -> None:
        """Initialize the token exposure detector."""
        self._findings: List[TokenExposureFinding] = []

    def scan_logs(self, file_path: str) -> List[TokenExposureFinding]:
        """Scan a log file for exposed tokens and sensitive data."""
        findings: List[TokenExposureFinding] = []
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return findings
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings
        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._detect_tokens_in_line(str(path.resolve()), line_number, line)
            findings.extend(line_findings)
        self._findings.extend(findings)
        return findings

    def scan_responses(self, file_path: str) -> List[TokenExposureFinding]:
        """Scan an API response file for exposed tokens and data."""
        findings: List[TokenExposureFinding] = []
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return findings
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings
        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._detect_tokens_in_line(str(path.resolve()), line_number, line)
            findings.extend(line_findings)
        self._findings.extend(findings)
        return findings

    def check_url_params(self, file_path: str) -> List[TokenExposureFinding]:
        """Check a file for URL parameters containing sensitive data or tokens."""
        findings: List[TokenExposureFinding] = []
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return findings
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings
        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._check_url_tokens(str(path.resolve()), line_number, line)
            findings.extend(line_findings)
        self._findings.extend(findings)
        return findings

    def _detect_tokens_in_line(
        self,
        file_path: str,
        line_number: int,
        line: str,
    ) -> List[TokenExposureFinding]:
        """Detect tokens and sensitive data in a line."""
        findings: List[TokenExposureFinding] = []
        for token_type, pattern in self.TOKEN_PATTERNS.items():
            match = pattern.search(line)
            if match:
                findings.append(TokenExposureFinding(
                    file_path=file_path,
                    line_number=line_number,
                    token_type=token_type,
                    exposed_text=self._redact(match.group()),
                    severity=self._get_token_severity(token_type),
                    description=f"{token_type.replace('_', ' ')} type token exposed in log",
                    recommendation=self._get_token_recommendation(token_type),
                ))
        return findings

    def _check_url_tokens(
        self,
        file_path: str,
        line_number: int,
        line: str,
    ) -> List[TokenExposureFinding]:
        """Check for tokens and sensitive data in URL parameters."""
        findings: List[TokenExposureFinding] = []
        url_param_patterns = [
            ("token", re.compile(r"token=([^&\s]+)")),
            ("key", re.compile(r"key=([^&\s]+)")),
            ("api_key", re.compile(r"api_key=([^&\s]+)")),
            ("secret", re.compile(r"secret=([^&\s]+)")),
            ("password", re.compile(r"password=([^&\s]+)")),
            ("auth_token", re.compile(r"auth_token=([^&\s]+)")),
        ]
        for ptype, pattern in url_param_patterns:
            match = pattern.search(line)
            if match:
                findings.append(TokenExposureFinding(
                    file_path=file_path,
                    line_number=line_number,
                    token_type=ptype,
                    exposed_text=self._redact(match.group(1)),
                    severity="high",
                    description=f"Sensitive Parameter {ptype} found in URL params",
                    recommendation="Use header for authentication instead of query parameters",
                ))
        if re.search(r"https?://[^:]+:[^@]+@", line):
            findings.append(TokenExposureFinding(
                file_path=file_path,
                line_number=line_number,
                token_type="url",
                exposed_text="URL with embedded credentials",
                severity="critical",
                description="Credentials embedded in URL",
                recommendation="Use authentication headers instead of URL-encoded credentials",
            ))
        return findings

    def _redact(self, text: str, visible_chars: int = 4) -> str:
        """Redact token text, showing visible_chars for context."""
        if len(text) <= visible_chars:
            return "*" * len(text)
        return text[:visible_chars] + "***" * (min(len(text) - visible_chars, 4) // 3 + 1)

    def _get_token_severity(self, token_type: str) -> str:
        """Get severity rating for a token type."""
        critical_types = {"kub", "aws_secret_key", "github_token",
                         "github_oauth", "paypal_api_key", "url"}
        high_types = {"jwt", "slack_token", "aws_access_key", "google_api_key"}
        if token_type in critical_types:
            return "critical"
        if token_type in high_types:
            return "high"
        return "medium"

    def _get_token_recommendation(self, token_type: str) -> str:
        """Get recommendation for a token type."""
        recommendations = {
            "kub": "Rotate KUB access key immediately. Use token services for short-term credentials.",
            "jwt": "Revoke all JWT tokens emitted locally. Use require-known-key for validation.",
            "github_token": "Revoke GitHub token immediately. Use GitHub Actions secrets instead.",
            "github_oauth": "Revoke GitHub OAuth pair and use token rotation",
            "slack_token": "Delete Slack token from configuration. Use Slack App CSM.",
            "aws_access_key": "Rotate AWS ACCESS key. Use IAM roles.",
            "aws_secret_key": "Rotate AWS Secret Access Key. Disable unused keys.",
            "google_api_key": "Delete Google API key from logs. Use generated APIs with restrictions.",
            "paypal_api_key": "Remove PayPal API key from logs. Use server-side payment processing.",
            "url": "Use authentication headers instead of URL-encoded credentials.",
        }
        return recommendations.get(token_type, "Revoke this token and implement secure token handling")
