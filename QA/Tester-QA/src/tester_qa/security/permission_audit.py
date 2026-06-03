"""Permission audit module for checking file and directory access controls."""

import os
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class PermissionFinding:
    """Represents an insecure file or directory permission finding."""

    file_path: str
    permission: str
    issue: str
    severity: str
    recommendation: str = ""

    def __str__(self) -> str:
        return (
            f"[{self.severity.upper()}] {self.issue} - "
            f"{self.file_path} ({self.permission}): {self.recommendation}"
        )


class PermissionAuditor:
    """Checks file permissions and directory access controls."""

    SENSITIVE_FILES: List[str] = [
        ".env", ".env.local", ".env.production",
        "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519",
        "*.pem", "*.key", "*.crt", "*.p12", "*.pfx",
        "credentials", ".netrc", ".git-credentials",
        "config.py", "settings.py", "secrets.yml",
        "docker-compose.yml", "docker-compose.yaml",
    ]

    SENSITIVE_EXTENSIONS: List[str] = [
        ".pem", ".key", ".crt", ".pfx", ".p12",
        ".ovpn", ".rdp", ".kdbx", ".kdb",
    ]

    def __init__(self) -> None:
        """Initialize the permission auditor."""
        self._findings: List[PermissionFinding] = []

    def audit_permissions(self, path: str, recursive: bool = False) -> List[PermissionFinding]:
        """Audit permissions of a file or directory.

        Args:
            path: Path to the file or directory to audit.
            recursive: Whether to audit directories recursively.

        Returns:
            List of PermissionFinding instances for permission issues.
        """
        findings: List[PermissionFinding] = []
        target = Path(path)

        if not target.exists():
            return findings

        if target.is_file():
            findings.extend(self._audit_file(target))
        elif target.is_dir():
            findings.extend(self._audit_directory(target))
            if recursive:
                findings.extend(self._audit_directory_recursive(target))

        self._findings.extend(findings)
        return findings

    def find_world_readable(self, directory: str) -> List[PermissionFinding]:
        """Find files that are world-readable in a directory.

        Args:
            directory: Path to the directory to scan.

        Returns:
            List of PermissionFinding instances for world-readable files.
        """
        findings: List[PermissionFinding] = []
        dir_path = Path(directory)

        if not dir_path.exists() or not dir_path.is_dir():
            return findings

        findings.extend(self._audit_directory_recursive(dir_path, world_check=True))

        self._findings.extend(findings)
        return findings

    def check_sensitive_files(self, directory: str) -> List[PermissionFinding]:
        """Check permissions on known sensitive file patterns.

        Args:
            directory: Path to the directory to scan.

        Returns:
            List of PermissionFinding instances for sensitive file issues.
        """
        findings: List[PermissionFinding] = []
        dir_path = Path(directory)

        if not dir_path.exists() or not dir_path.is_dir():
            return findings

        for file_path in dir_path.rglob("*"):
            if not file_path.is_file():
                continue

            name = file_path.name.lower()
            ext = file_path.suffix.lower()

            is_sensitive = any(
                pattern.replace("*", "") in name
                for pattern in self.SENSITIVE_FILES
                if "*" in pattern
            ) or any(
                name == s.lower() for s in self.SENSITIVE_FILES
            ) or ext in self.SENSITIVE_EXTENSIONS

            if is_sensitive:
                findings.extend(self._audit_file(file_path))

        self._findings.extend(findings)
        return findings

    def _audit_file(self, file_path: Path) -> List[PermissionFinding]:
        """Audit a single file's permissions."""
        findings: List[PermissionFinding] = []

        try:
            mode = file_path.stat().st_mode
        except (OSError, PermissionError):
            return findings

        perm_string = self._format_permissions(mode)
        issues = self._check_permission_issues(mode, perm_string, file_path)

        for issue, severity, recommendation in issues:
            findings.append(PermissionFinding(
                file_path=str(file_path.resolve()),
                permission=perm_string,
                issue=issue,
                severity=severity,
                recommendation=recommendation,
            ))

        return findings

    def _audit_directory(self, dir_path: Path) -> List[PermissionFinding]:
        """Audit a single directory's permissions."""
        findings: List[PermissionFinding] = []

        try:
            mode = dir_path.stat().st_mode
        except (OSError, PermissionError):
            return findings

        perm_string = self._format_permissions(mode)

        # Check world-writable directory
        if mode & stat.S_IWOTH:
            findings.append(PermissionFinding(
                file_path=str(dir_path.resolve()),
                permission=perm_string,
                issue="World-writable directory",
                severity="high",
                recommendation="Remove world-write permission (chmod o-w)",
            ))

        # Check directory is executable (needed for access)
        if not (mode & stat.S_IXUSR):
            findings.append(PermissionFinding(
                file_path=str(dir_path.resolve()),
                permission=perm_string,
                issue="Directory not executable for owner",
                severity="medium",
                recommendation="Add owner execute permission (chmod u+x)",
            ))

        self._findings.extend(findings)
        return findings

    def _audit_directory_recursive(
        self,
        dir_path: Path,
        world_check: bool = False,
    ) -> List[PermissionFinding]:
        """Recursively audit all files in a directory."""
        findings: List[PermissionFinding] = []

        for item in dir_path.rglob("*"):
            if item.is_file():
                file_findings = self._audit_file(item)
                if world_check:
                    file_findings = [
                        f for f in file_findings
                        if f.issue == "World-readable file"
                    ]
                findings.extend(file_findings)
            elif item.is_dir():
                dir_findings = self._audit_directory(item)
                if world_check:
                    dir_findings = [
                        d for d in dir_findings
                        if d.issue == "World-writable directory"
                    ]
                findings.extend(dir_findings)

        return findings

    def _check_permission_issues(
        self,
        mode: int,
        perm_string: str,
        file_path: Path,
    ) -> List[Tuple[str, str, str]]:
        """Analyze file mode and return list of issues."""
        issues: List[Tuple[str, str, str]] = []

        # Check world-readable
        if mode & stat.S_IROTH:
            issues.append((
                "World-readable file",
                "medium",
                "Remove world-read permission (chmod o-r) if file contains sensitive data",
            ))

        # Check world-writable
        if mode & stat.S_IWOTH:
            issues.append((
                "World-writable file",
                "high",
                "Remove world-write permission (chmod o-w) to prevent unauthorized modification",
            ))

        # Check group-writable
        if mode & stat.S_IWGRP:
            issues.append((
                "Group-writable file",
                "medium",
                "Review group membership and remove group-write if not needed (chmod g-w)",
            ))

        # Check executable for others
        if mode & stat.S_IXOTH:
            issues.append((
                "World-executable file",
                "medium",
                "Remove world-execute permission (chmod o-x) if not needed",
            ))

        # Check if file is executable by owner but shouldn't be
        name = file_path.name.lower()
        ext = file_path.suffix.lower()
        if (mode & stat.S_IXUSR) and ext in [".py", ".rb", ".sh", ".js", ".ts"]:
            # Scripts should be explicitly made executable, flag if unusual location
            if not any(s in str(file_path) for s in ["/bin/", "/sbin/", "/usr/bin/", "/scripts/"]):
                issues.append(( 
                    "Executable script in non-standard location",
                    "low",
                    "Verify this file should be executable",
                ))

        return issues

    def _format_permissions(self, mode: int) -> str:
        """Format file mode into readable permission string like 'rwxr-xr--'."""
        chars = []
        for who in [stat.S_IRUSR, stat.S_IWUSR, stat.S_IXUSR,
                    stat.S_IRGRP, stat.S_IWGRP, stat.S_IXGRP,
                    stat.S_IROTH, stat.S_IWOTH, stat.S_IXOTH]:
            chars.append("r" if mode & who else "-")
            who = who >> 1
            if mode & who:
                chars[-1] = chars[-1].replace("-", "w")
            who = who >> 1
            if mode & who:
                chars[-1] = chars[-1].replace("-", "x")

        result = []
        for i in range(3):
            idx = i * 3
            result.append(chars[idx] + chars[idx + 1] + chars[idx + 2])

        return "".join(result)
