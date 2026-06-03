"""Unsafe command detection module for identifying dangerous shell operations."""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class UnsafeCommandFinding:
    """Represents a detected unsafe or dangerous command."""

    file_path: str
    line_number: int
    command: str
    risk_type: str
    severity: str
    description: str
    recommendation: str = ""

    def __str__(self) -> str:
        return (
            f"[{self.severity.upper()}] {self.risk_type} in "
            f"{self.file_path}:{self.line_number} - {self.description}"
        )


class UnsafeCommandDetector:
    """Detects dangerous shell commands in code that could lead to injection."""

    DANGEROUS_COMMANDS: Set[str] = {
        "rm", "del", "rmdir", "unlink", "remove",
        "curl", "wget",
        "chmod", "chown", "chgrp",
        "mkfs", "dd", "fdisk",
        "shutdown", "reboot", "halt", "poweroff",
        "kill", "killall", "pkill",
        "eval", "exec",
        "source", ".",
        "cat", "less", "more", "tail", "head",
    }

    DANGEROUS_FLAGS: Set[str] = {
        "rm -rf", "rm -r /", "rm -f",
        "curl -k", "wget --no-check-certificate",
        "chmod 777", "chmod -R 777",
        "chown -R", "chgrp -R",
        "eval $", "exec $",
    }

    INJECTION_PATTERNS: Dict[str, str] = {
        "os_system": r"os\.system\s*\(",
        "os_popen": r"os\.popen\s*\(",
        "subprocess_shell_true": r"subprocess\.(run|Popen|call|check_output)\s*\([^)]*shell\s*=\s*True",
        "subprocess_external": r"subprocess\.(run|Popen|call|check_output)\s*\([^)]*\bre\b?",
        "exec_": r"\bexec\s*\(",
        "eval_": r"\beval\s*\(",
        "child_process_exec": r"child_process\.exec\s*\(",
        "child_process_spawn": r"child_process\.spawn\s*\([^)]*shell\s*:\s*true",
        "shell_exec": r"shell_exec\s*\(",
        "system_": r"\bsystem\s*\(",
        "passthru": r"passthru\s*\(",
        "proc_open": r"proc_open\s*\(",
        "popen": r"\bpopen\s*\(",
    }

    UNSAFE_TEMPLATE_PATTERNS: List[str] = [
        r'["\'].*%s.*["\']\s*%\s*\(',
        r'["\'].*\{\}.*["\']\s*\.format\s*\(',
        r'f["\'][^"\']*\{[^"\']+\}[^"\']*["\']',
        r'`[^`]*\$[^`]*`',
    ]

    def __init__(self) -> None:
        """Initialize the unsafe command detector."""
        self._findings: List[UnsafeCommandFinding] = []

    def scan_for_unsafe_commands(self, file_path: str) -> List[UnsafeCommandFinding]:
        """Scan a file for unsafe shell commands.

        Args:
            file_path: Path to the file to scan.

        Returns:
            List of UnsafeCommandFinding instances for dangerous commands found.
        """
        findings: List[UnsafeCommandFinding] = []
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            return findings

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings

        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._analyze_line(str(path.resolve()), line_number, line)
            findings.extend(line_findings)

        self._findings.extend(findings)
        return findings

    def check_injection_risk(self, file_path: str) -> List[UnsafeCommandFinding]:
        """Check a file for command injection vulnerabilities.

        Args:
            file_path: Path to the file to scan.

        Returns:
            List of UnsafeCommandFinding instances for injection risks found.
        """
        findings: List[UnsafeCommandFinding] = []
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            return findings

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings

        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            # Check for injection-prone patterns
            for pattern_name, pattern in self.INJECTION_PATTERNS.items():
                if re.search(pattern, line):
                    findings.append(UnsafeCommandFinding(
                        file_path=str(path.resolve()),
                        line_number=line_number,
                        command=line.strip()[:100],
                        risk_type="command_injection",
                        severity=self._get_injection_severity(pattern_name),
                        description=f"Potential command injection via {pattern_name}",
                        recommendation=f"Avoid using {pattern_name} with untrusted input. Consider subprocess.run() with shell=False.",
                    ))

            # Check for unsafe string formatting with commands
            for tmpl_pattern in self.UNSAFE_TEMPLATE_PATTERNS:
                if re.search(tmpl_pattern, line):
                    if any(cmd in line.lower() for cmd in self.DANGEROUS_COMMANDS):
                        findings.append(UnsafeCommandFinding(
                            file_path=str(path.resolve()),
                            line_number=line_number,
                            command=line.strip()[:100],
                            risk_type="string_injection",
                            severity="high",
                            description="Unsafe string interpolation in command context",
                            recommendation="Use parameterized commands or whitelist validation",
                        ))

            # Check for user input in commands
            if self._contains_user_input(line):
                if any(cmd in line.lower() for cmd in self.DANGEROUS_COMMANDS):
                    findings.append(UnsafeCommandFinding(
                        file_path=str(path.resolve()),
                        line_number=line_number,
                        command=line.strip()[:100],
                        risk_type="user_input_injection",
                        severity="critical",
                        description="User input directly used in dangerous command",
                        recommendation="Sanitize and validate all user input before using in commands",
                    ))

        self._findings.extend(findings)
        return findings

    def _analyze_line(
        self,
        file_path: str,
        line_number: int,
        line: str,
    ) -> List[UnsafeCommandFinding]:
        """Analyze a single line for unsafe commands."""
        findings: List[UnsafeCommandFinding] = []
        lower_line = line.lower()

        # Check for dangerous command flags
        for flag in self.DANGEROUS_FLAGS:
            if flag.lower() in lower_line:
                findings.append(UnsafeCommandFinding(
                    file_path=file_path,
                    line_number=line_number,
                    command=line.strip()[:100],
                    risk_type="dangerous_flag",
                    severity=self._get_flag_severity(flag),
                    description=f"Dangerous flag detected: {flag}",
                    recommendation=self._get_flag_recommendation(flag),
                ))

        # Check for shell=True in subprocess
        if "shell=true" in lower_line or "shell = true" in lower_line:
            findings.append(UnsafeCommandFinding(
                file_path=file_path,
                line_number=line_number,
                command=line.strip()[:100],
                risk_type="shell_injection",
                severity="high",
                description="subprocess with shell=True enables shell injection",
                recommendation="Use shell=False and pass arguments as a list",
            ))

        # Check for dangerous command usage
        for command in self.DANGEROUS_COMMANDS:
            pattern = rf'\b{re.escape(command)}\s*\('
            if re.search(pattern, lower_line):
                findings.append(UnsafeCommandFinding(
                    file_path=file_path,
                    line_number=line_number,
                    command=line.strip()[:100],
                    risk_type="dangerous_command",
                    severity=self._get_command_severity(command),
                    description=f"Use of potentially dangerous command: {command}",
                    recommendation=self._get_command_recommendation(command),
                ))

        return findings

    def _contains_user_input(self, line: str) -> bool:
        """Check if a line contains potential user input."""
        user_input_patterns = [
            r"request\.(args|form|values|get)",
            r"input\(",
            r"sys\.argv",
            r"process\.env\.",
            r"req\.body",
            r"req\.query",
            r"req\.params",
            r"\$\{?[A-Z_]+\}?",
            r"\{\s*[a-z_]",
            r"%s",
            r"\.format\s*\(",
        ]

        for pattern in user_input_patterns:
            if re.search(pattern, line, re.IGNORECASE):
                return True
        return False

    def _get_injection_severity(self, pattern_name: str) -> str:
        """Get severity rating for an injection pattern."""
        critical = {"eval_", "exec_", "os_system", "os_popen"}
        high = {"subprocess_shell_true", "subprocess_external", "child_process_spawn"}
        medium = {"child_process_exec", "shell_exec", "system_", "passthru", "proc_open"}

        if pattern_name in critical:
            return "critical"
        if pattern_name in high:
            return "high"
        if pattern_name in medium:
            return "medium"
        return "low"

    def _get_flag_severity(self, flag: str) -> str:
        """Get severity rating for a dangerous flag."""
        critical_flags = {"rm -rf", "rm -r /"}
        high_flags = {"rm -f", "chmod 777", "chmod -R 777", "curl -k", "wget --no-check-certificate"}

        if flag in critical_flags:
            return "critical"
        if flag in high_flags:
            return "high"
        return "medium"

    def _get_flag_recommendation(self, flag: str) -> str:
        """Get recommendation for a dangerous flag."""
        recommendations = {
            "rm -rf": "Avoid recursive forced deletion. Use specific paths and confirm before removal.",
            "rm -r /": "This command would delete the entire filesystem. Remove immediately.",
            "rm -f": "Ensure path is correct. Consider adding interactive confirmation.",
            "chmod 777": "Avoid world-writable permissions. Use minimal permissions needed.",
            "chmod -R 777": "Never set recursive 777 permissions. Use appropriate permission levels.",
            "curl -k": "Skipping certificate verification is insecure. Use proper certificates.",
            "wget --no-check-certificate": "Certificate verification disabled. Use proper certificates.",
        }
        return recommendations.get(flag, "Review this flag for potential security issues.")

    def _get_command_severity(self, command: str) -> str:
        """Get severity rating for a dangerous command."""
        critical_commands = {"rm", "shutdown", "reboot", "halt", "mkfs", "dd", "fdisk"}
        high_commands = {"chmod", "chown", "kill", "killall", "pkill"}
        medium_commands = {"curl", "wget", "eval", "exec"}

        if command in critical_commands:
            return "critical"
        if command in high_commands:
            return "high"
        if command in medium_commands:
            return "medium"
        return "low"

    def _get_command_recommendation(self, command: str) -> str:
        """Get recommendation for a dangerous command."""
        recommendations = {
            "rm": "Use safe file deletion. Consider trash instead of permanent removal.",
            "curl": "Validate URL input. Use --disable for certificate checks if needed.",
            "wget": "Validate URL input. Prefer curl for more security options.",
            "chmod": "Use specific permission values. Avoid 777 and world-writable.",
            "chown": "Only change ownership when necessary and permitted.",
            "eval": "Never pass untrusted input to eval. Use ast.literal_eval for safe parsing.",
            "exec": "Avoid exec with user input. Use safe alternatives for dynamic code.",
            "kill": "Verify target process before killing. Use full process paths.",
            "shutdown": "Ensure proper authorization before system shutdown.",
            "reboot": "Verify privilege and necessity before rebooting system.",
        }
        return recommendations.get(command, f"Review use of {command} for potential security issues.")
