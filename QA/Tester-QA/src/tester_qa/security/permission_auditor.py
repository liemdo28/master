"""Permission Auditor — Detect dangerous file permissions and access controls."""
from __future__ import annotations

import os
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class PermissionFinding:
    path: str
    issue: str
    current_mode: str
    severity: str
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "issue": self.issue,
            "current_mode": self.current_mode,
            "severity": self.severity,
            "recommendation": self.recommendation,
        }


DANGEROUS_EXTENSIONS = {".key", ".pem", ".crt", ".p12", ".pfx", ".env", ".cfg", ".ini", ".conf"}
DANGEROUS_FILENAMES = {"id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "authorized_keys", ".netrc", "cookies.txt"}


class PermissionAuditor:
    """Audit filesystem permissions for dangerous configurations."""

    def audit_permissions(self, root: Path | str) -> list[PermissionFinding]:
        findings = []
        root_path = Path(root)
        if not root_path.exists():
            return findings

        skip = {".git", "node_modules", "__pycache__", ".venv", "venv"}
        for item in root_path.rglob("*"):
            if item.is_symlink():
                findings.append(PermissionFinding(
                    path=str(item),
                    issue="Symbolic link detected",
                    current_mode="symlink",
                    severity="medium",
                    recommendation="Review symlink target for security implications",
                ))
                continue

            if not item.is_file():
                continue

            if any(skip in item.parts for skip in skip):
                continue

            try:
                mode = stat.S_IMODE(item.stat().st_mode)
            except OSError:
                continue

            mode_str = oct(mode)
            is_executable = bool(mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH))
            is_world_writable = bool(mode & stat.S_IWOTH)
            is_group_writable = bool(mode & stat.S_IWGRP)

            if is_world_writable and item.suffix in DANGEROUS_EXTENSIONS:
                findings.append(PermissionFinding(
                    path=str(item),
                    issue="World-writable file with sensitive extension",
                    current_mode=mode_str,
                    severity="critical",
                    recommendation="Remove world-write: chmod o-w <file>",
                ))

            if is_world_writable and item.name in DANGEROUS_FILENAMES:
                findings.append(PermissionFinding(
                    path=str(item),
                    issue="World-writable credential file",
                    current_mode=mode_str,
                    severity="critical",
                    recommendation="Remove world-write: chmod 600 <file>",
                ))

            if is_group_writable and item.suffix in DANGEROUS_EXTENSIONS:
                findings.append(PermissionFinding(
                    path=str(item),
                    issue="Group-writable sensitive file",
                    current_mode=mode_str,
                    severity="high",
                    recommendation="Restrict group write: chmod 640 <file>",
                ))

            if is_executable and item.suffix in {".key", ".pem", ".env"}:
                findings.append(PermissionFinding(
                    path=str(item),
                    issue="Sensitive file marked as executable",
                    current_mode=mode_str,
                    severity="high",
                    recommendation="Remove executable bit: chmod 600 <file>",
                ))

            if mode & stat.S_ISUID or mode & stat.S_ISGID:
                findings.append(PermissionFinding(
                    path=str(item),
                    issue="Setuid/setgid bit detected on file",
                    current_mode=mode_str,
                    severity="critical",
                    recommendation="Review necessity of setuid/setgid; remove if not required",
                ))

        return findings
