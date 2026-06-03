from __future__ import annotations

from pathlib import Path
import re

from tester_qa.audit.models import AuditFinding
from tester_qa.models import Severity


SECRET_MARKERS = ["api_key", "secret", "token", "password", "private_key"]


def audit_security(path: Path | str) -> list[AuditFinding]:
    root = Path(path).expanduser().resolve()
    findings: list[AuditFinding] = []
    for file_path in root.rglob("*"):
        if _skip(file_path) or not file_path.is_file():
            continue
        if file_path.name == ".env":
            findings.append(AuditFinding("security", Severity.HIGH, "Raw .env file present", [str(file_path)]))
            continue
        if file_path.suffix in {".py", ".js", ".ts", ".tsx", ".json", ".env", ".md"} and file_path.stat().st_size < 250_000:
            text = file_path.read_text(encoding="utf-8", errors="replace")
            hits = [marker for marker in SECRET_MARKERS if _has_secret_assignment(text, marker)]
            if hits:
                findings.append(AuditFinding("security", Severity.MEDIUM, "Potential secret marker found", [str(file_path), *hits]))
    return findings


def _skip(path: Path) -> bool:
    return any(
        part in {
            ".git",
            ".next",
            ".pytest_cache",
            ".venv",
            "__pycache__",
            "build",
            "dist",
            "node_modules",
            "reports",
            "venv",
        }
        for part in path.parts
    )


def _has_secret_assignment(text: str, marker: str) -> bool:
    pattern = re.compile(rf"(?i)\b{re.escape(marker)}\b\s*[:=]\s*[\"']([^\"']{{8,}})[\"']")
    for match in pattern.finditer(text):
        value = match.group(1).strip()
        if value.startswith("<") and value.endswith(">"):
            continue
        if value.startswith("TESTER_QA_"):
            continue
        return True
    return False
