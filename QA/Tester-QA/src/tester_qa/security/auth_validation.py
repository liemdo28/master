"""Authentication validation module for checking auth implementations."""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class AuthFinding:
    """Represents an authentication security finding."""

    file_path: str
    line_number: int
    auth_issue: str
    severity: str
    description: str
    recommendation: str = ""

    def __str__(self) -> str:
        return (
            f"[{self.severity.upper()}] {self.auth_issue} in "
            f"{self.file_path}:{self.line_number}: {self.description}"
        )


class AuthValidator:
    """Validates authentication implementations for security issues."""

    def __init__(self) -> None:
        """Initialize the auth validator."""
        self._findings: List[AuthFinding] = []

    def check_auth_headers(self, file_path: str) -> List[AuthFinding]:
        """Check for authentication header issues in source files."""
        findings: List[AuthFinding] = []
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return findings
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings
        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._check_header_issues(str(path.resolve()), line_number, line)
            findings.extend(line_findings)
        self._findings.extend(findings)
        return findings

    def validate_token_handling(self, file_path: str) -> List[AuthFinding]:
        """Validate token generation, storage, and validation logic."""
        findings: List[AuthFinding] = []
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return findings
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings
        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._check_token_issues(str(path.resolve()), line_number, line)
            findings.extend(line_findings)
        if self._has_token_generation(content) and not self._has_token_expiry(content):
            findings.append(AuthFinding(
                file_path=str(path.resolve()), line_number=0,
                auth_issue="missing_token_expiry", severity="high",
                description="Token generation without expiry setting detected",
                recommendation="Set token expiration times (exp, expiring) for all tokens"))
        if self._uses_weak_token_gen(content):
            findings.append(AuthFinding(
                file_path=str(path.resolve()), line_number=0,
                auth_issue="weak_token_generation", severity="medium",
                description="Weak or predictable token generation detected",
                recommendation="Use cryptographically secure random generators for tokens"))
        self._findings.extend(findings)
        return findings

    def find_auth_bypass(self, file_path: str) -> List[AuthFinding]:
        """Find potential authentication bypass vulnerabilities."""
        findings: List[AuthFinding] = []
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return findings
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            return findings
        lines = content.splitlines()
        for line_number, line in enumerate(lines, start=1):
            line_findings = self._check_bypass_patterns(str(path.resolve()), line_number, line)
            findings.extend(line_findings)
        bypass_patterns = [
            (r"#.*if.*auth", "commented_auth_check"),
            (r"#.*verify", "commented_verification"),
            (r"return\s+True", "always_true_return"),
            (r"if\s+True\s*:", "dead_code_auth"),
        ]
        for line_number, line in enumerate(lines, start=1):
            for pattern, bypass_type in bypass_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append(AuthFinding(
                        file_path=str(path.resolve()), line_number=line_number,
                        auth_issue=bypass_type, severity="high",
                        description=f"Potential auth bypass: {bypass_type}",
                        recommendation="Ensure authentication checks are active and not bypassed"))
        self._findings.extend(findings)
        return findings

    def _check_header_issues(self, file_path: str, line_number: int, line: str) -> List[AuthFinding]:
        findings: List[AuthFinding] = []
        if re.search(r"https?://[^:]+:[^@]+@", line):
            findings.append(AuthFinding(
                file_path=file_path, line_number=line_number,
                auth_issue="credentials_in_url", severity="high",
                description="Authentication credentials embedded in URL",
                recommendation="Use proper authentication headers instead of URL-embedded credentials"))
        basic_auth_pattern = r'(?i)(basic|user|pass|auth)\s*[=: ]\s*["\']\w+["\']'
        if re.search(basic_auth_pattern, line):
            findings.append(AuthFinding(
                file_path=file_path, line_number=line_number,
                auth_issue="hardcoded_credentials", severity="critical",
                description="Hardcoded authentication credentials detected",
                recommendation="Store credentials in environment variables or secure vault"))
        if re.search(r'(?i)(secure|httponly)\s*[=: ]\s*false', line):
            findings.append(AuthFinding(
                file_path=file_path, line_number=line_number,
                auth_issue="insecure_cookie_flag", severity="medium",
                description="Cookie missing secure flag or has insecure flag",
                recommendation="Set secure=True and httponly=True for session cookies"))
        return findings

    def _check_token_issues(self, file_path: str, line_number: int, line: str) -> List[AuthFinding]:
        findings: List[AuthFinding] = []
        if re.search(r'(?i)(alg\s*:|algorithm.*)=.*["\']?none["\']?', line):
            findings.append(AuthFinding(
                file_path=file_path, line_number=line_number,
                auth_issue="jwt_none_algorithm", severity="critical",
                description="JWT algorithm set to none - tokens are unsigned",
                recommendation="Use RS256 or ES256 algorithm for JWT signing"))
        if re.search(r'(?i)(token|key)\s*[=:]\s*(req|request)', line):
            findings.append(AuthFinding(
                file_path=file_path, line_number=line_number,
                auth_issue="token_in_query_string", severity="medium",
                description="Token or API key passed via query string",
                recommendation="Use Authorization header instead of query parameters"))
        return findings

    def _check_bypass_patterns(self, file_path: str, line_number: int, line: str) -> List[AuthFinding]:
        findings: List[AuthFinding] = []
        bypass_indicators = [
            (r"if\s+False\s*:", "disabled_auth_check"),
            (r"#.*auth", "commented_out_auth"),
            (r"skip\s*=\s*True", "skip_auth_flag"),
            (r"debug.*=.*True", "debug_mode_bypass"),
        ]
        for pattern, bypass_type in bypass_indicators:
            if re.search(pattern, line, re.IGNORECASE):
                findings.append(AuthFinding(
                    file_path=file_path, line_number=line_number,
                    auth_issue=bypass_type, severity="high",
                    description=f"Potential authentication bypass detected: {bypass_type}",
                    recommendation="Review and ensure authentication is properly enforced"))
        return findings

    def _has_token_generation(self, content: str) -> bool:
        patterns = [r"jwt.encode", r"generate_token", r"create_token", r"make_token", r"sign\(.*algo"]
        return any(re.search(p, content, re.IGNORECASE) for p in patterns)

    def _has_token_expiry(self, content: str) -> bool:
        patterns = [r"expire", r"expir(at|y)", r"max_age", r"exp\s*=", r"expires_in"]
        return any(re.search(p, content, re.IGNORECASE) for p in patterns)

    def _uses_weak_token_gen(self, content: str) -> bool:
        weak_patterns = [r"random.random", r"time.time", r"uuid", r"md5", r"sha1"]
        return any(re.search(p, content, re.IGNORECASE) for p in weak_patterns)
