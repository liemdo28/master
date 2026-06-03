"""Secret Scanner — Detect exposed secrets in codebases."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

# High-confidence secret patterns
SECRET_PATTERNS = [
    (re.compile(r"(?i)(api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['\"]([a-zA-Z0-9_\-]{20,})['\"]"), "API_KEY"),
    (re.compile(r"(?i)(private[_-]?key|secret[_-]?key|sk)\s*[:=]\s*['\"]([a-zA-Z0-9_\-+=/]{20,})['\"]"), "SECRET_KEY"),
    (re.compile(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]+"), "BEARER_TOKEN"),
    (re.compile(r"(?i)ghp_[a-zA-Z0-9]{36,}"), "GITHUB_TOKEN"),
    (re.compile(r"(?i)gho_[a-zA-Z0-9]{36,}"), "GITHUB_OAUTH"),
    (re.compile(r"(?i)glpat-[a-zA-Z0-9\-]{20,}"), "GITLAB_TOKEN"),
    (re.compile(r"(?i)sk-[a-zA-Z0-9]{48,}"), "OPENAI_KEY"),
    (re.compile(r"(?i)sk-proj-[a-zA-Z0-9_\-]{48,}"), "OPENAI_PROJECT_KEY"),
    (re.compile(r"(?i)aws[_-]?(access[_-]?key[_-]?id|secret[_-]?access[_-]?key)\s*[:=]\s*['\"]([A-Z0-9]{16,})['\"]"), "AWS_KEY"),
    (re.compile(r"(?i)AKIA[0-9A-Z]{16}"), "AWS_ACCESS_KEY"),
    (re.compile(r"(?i)(database[_-]?url|db[_-]?url|postgres://|mysql://|mongodb://)\s*[:=]\s*['\"][^\s'\"]{20,}['\"]"), "DB_CONNECTION"),
    (re.compile(r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"][^\s'\"]{8,}['\"]"), "PASSWORD"),
    (re.compile(r"(?i)(jwt|json[_-]?web[_-]?token)\s*[:=]\s*['\"](eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+)['\"]"), "JWT"),
    (re.compile(r"(?i)stripe[_-]?(sk|pk)[_-]?(live|test)[_-]?[a-zA-Z0-9]{20,}"), "STRIPE_KEY"),
    (re.compile(r"(?i)twilio[_-]?(account[_-]?sid|auth[_-]?token)\s*[:=]\s*['\"][A-Za-z0-9]{20,}['\"]"), "TWILIO_KEY"),
    (re.compile(r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"), "PRIVATE_KEY"),
    (re.compile(r"(?i)(firebase|google)[_-]?(api[_-]?key|credentials)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]"), "FIREBASE_KEY"),
    (re.compile(r"(?i)slack[_-]?(webhook|token)\s*[:=]\s*['\"]https?://[^\s'\"]{20,}['\"]"), "SLACK_WEBHOOK"),
    (re.compile(r"(?i)(sendgrid|mailgun|mailchimp)[_-]?api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{20,}['\"]"), "EMAIL_SERVICE_KEY"),
]

# Safe directories to skip
SKIP_PATTERNS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".env", ".next", "dist", "build", ".cache"}

# Safe filenames
SKIP_FILES = {".gitignore", ".dockerignore", "package-lock.json", "yarn.lock", "poetry.lock", ".DS_Store"}


@dataclass
class SecretFinding:
    file_path: str
    line_number: int
    line_content: str
    secret_type: str
    severity: str = "high"
    masked_value: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "line_content": self.line_content,
            "secret_type": self.secret_type,
            "severity": self.severity,
            "masked_value": self.masked_value,
        }


def _mask_secret(secret_type: str, value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "*" * (len(value) - 8) + value[-4:]


class SecretScanner:
    """Scan codebase for exposed secrets and credentials."""

    def __init__(self, skip_patterns: set[str] | None = None) -> None:
        self.skip_patterns = skip_patterns or SKIP_PATTERNS
        self.findings: list[SecretFinding] = []

    def scan_directory(self, root: Path | str, extensions: list[str] | None = None) -> list[SecretFinding]:
        """Recursively scan a directory for secrets."""
        root_path = Path(root)
        if not root_path.exists():
            return []
        self.findings = []
        extensions = extensions or [
            ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".java", ".rb", ".php",
            ".yaml", ".yml", ".json", ".env", ".toml", ".ini", ".cfg", ".conf",
            ".sh", ".bash", ".zsh", ".sql", ".md", ".txt",
        ]
        for file_path in self._iter_files(root_path, extensions):
            self._scan_file(file_path)
        return self.findings

    def _iter_files(self, root: Path, extensions: list[str]) -> Iterator[Path]:
        for item in root.rglob("*"):
            if item.is_file():
                if item.name in SKIP_FILES:
                    continue
                if any(skip in item.parts for skip in self.skip_patterns):
                    continue
                if item.suffix in extensions:
                    yield item

    def _severity_for_type(self, secret_type: str) -> str:
        critical = {"PRIVATE_KEY", "GITHUB_TOKEN", "GITHUB_OAUTH", "GITLAB_TOKEN",
                    "AWS_ACCESS_KEY", "AWS_KEY", "STRIPE_KEY"}
        high = {"OPENAI_KEY", "OPENAI_PROJECT_KEY", "FIREBASE_KEY", "DB_CONNECTION",
                "JWT", "BEARER_TOKEN", "SLACK_WEBHOOK", "EMAIL_SERVICE_KEY"}
        if secret_type in critical:
            return "critical"
        if secret_type in high:
            return "high"
        return "medium"

    def _scan_file(self, file_path: Path) -> None:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return

        lines = content.splitlines()
        for line_no, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("/*"):
                continue

            for pattern, secret_type in SECRET_PATTERNS:
                match = pattern.search(line)
                if match:
                    groups = match.groups()
                    raw_value = groups[-1] if groups else match.group(0)
                    masked = _mask_secret(secret_type, raw_value)
                    self.findings.append(SecretFinding(
                        file_path=str(file_path.relative_to(file_path.parent.parent) if file_path.is_absolute() else file_path),
                        line_number=line_no,
                        line_content=line.strip(),
                        secret_type=secret_type,
                        severity=self._severity_for_type(secret_type),
                        masked_value=masked,
                    ))
