"""Crash Analysis Module - Analyzes crashes across Python, Node.js, and generic systems."""

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class CrashSeverity(Enum):
    """Severity levels for crash reports."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class CrashType(Enum):
    """Types of crashes that can be analyzed."""
    PYTHON_TRACEBACK = "python_traceback"
    NODEJS_ERROR = "nodejs_error"
    GENERIC_CRASH = "generic_crash"
    SEGFAULT = "segfault"
    OOM = "out_of_memory"
    TIMEOUT = "timeout"
    UNHANDLED_EXCEPTION = "unhandled_exception"


@dataclass
class CrashReport:
    """Structured crash report with full forensic context."""
    timestamp: datetime
    error_type: str
    stack_trace: str
    context: Dict[str, Any]
    root_cause: Optional[str]
    affected_systems: List[str]
    severity: CrashSeverity
    crash_id: Optional[str] = None
    correlation_id: Optional[str] = None
    environment: Optional[Dict[str, str]] = None
    recovery_actions: List[str] = field(default_factory=list)
    timeline: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Export crash report as dictionary."""
        return {
            "crash_id": self.crash_id,
            "timestamp": self.timestamp.isoformat(),
            "error_type": self.error_type,
            "stack_trace": self.stack_trace,
            "context": self.context,
            "root_cause": self.root_cause,
            "affected_systems": self.affected_systems,
            "severity": self.severity.value,
            "correlation_id": self.correlation_id,
            "environment": self.environment,
            "recovery_actions": self.recovery_actions,
            "timeline": self.timeline,
        }

    def to_forensics_report(self) -> str:
        """Export as human-readable forensics report."""
        lines = [
            "=" * 60,
            "CRASH FORENSICS REPORT",
            "=" * 60,
            f"Crash ID:        {self.crash_id or 'N/A'}",
            f"Timestamp:       {self.timestamp.isoformat()}",
            f"Severity:        {self.severity.value.upper()}",
            f"Error Type:      {self.error_type}",
            f"Root Cause:      {self.root_cause or 'Under investigation'}",
            "",
            "AFFECTED SYSTEMS:",
        ]
        for system in self.affected_systems:
            lines.append(f"  - {system}")
        lines.extend([
            "",
            "STACK TRACE:",
            self.stack_trace,
            "",
            "CONTEXT:",
        ])
        for key, value in self.context.items():
            lines.append(f"  {key}: {value}")
        if self.recovery_actions:
            lines.extend(["", "RECOVERY ACTIONS:"])
            for i, action in enumerate(self.recovery_actions, 1):
                lines.append(f"  {i}. {action}")
        lines.append("=" * 60)
        return "\n".join(lines)


class CrashAnalyzer:
    """Analyzes crashes from multiple runtime environments."""

    def __init__(self) -> None:
        self._crash_history: List[CrashReport] = []
        self._patterns: Dict[str, List[str]] = {
            "python": [
                r"Traceback \(most recent call last\)",
                r"^\w+Error:",
                r"^\w+Exception:",
            ],
            "nodejs": [
                r"at\s+\w+\s+\(.*:\d+:\d+\)",
                r"Error:\s+",
                r"TypeError:",
                r"ReferenceError:",
                r"UnhandledPromiseRejection",
            ],
            "segfault": [
                r"Segmentation fault",
                r"SIGSEGV",
                r"signal 11",
            ],
            "oom": [
                r"Out of memory",
                r"MemoryError",
                r"ENOMEM",
                r"JavaScript heap out of memory",
            ],
        }

    async def analyze_crash(
        self,
        crash_data: str,
        crash_type: Optional[CrashType] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CrashReport:
        """Analyze a crash and produce a structured report.

        Args:
            crash_data: Raw crash output (traceback, error log, core dump text).
            crash_type: Optional explicit crash type. Auto-detected if not provided.
            metadata: Optional additional context about the crash.

        Returns:
            CrashReport with full analysis.
        """
        if crash_type is None:
            crash_type = self._detect_crash_type(crash_data)

        context = self.get_crash_context(crash_data, crash_type, metadata)
        root_cause = self.identify_root_cause(crash_data, crash_type)
        timeline = self.get_crash_timeline(crash_data)
        error_type = self._extract_error_type(crash_data, crash_type)
        affected = self._identify_affected_systems(crash_data, context)
        severity = self._assess_severity(crash_data, crash_type, affected)

        report = CrashReport(
            timestamp=datetime.utcnow(),
            error_type=error_type,
            stack_trace=crash_data,
            context=context,
            root_cause=root_cause,
            affected_systems=affected,
            severity=severity,
            crash_id=f"crash-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            correlation_id=metadata.get("correlation_id") if metadata else None,
            environment=metadata.get("environment") if metadata else None,
            recovery_actions=self._suggest_recovery(crash_type, root_cause),
            timeline=timeline,
        )

        self._crash_history.append(report)
        return report

    def get_crash_context(
        self,
        crash_data: str,
        crash_type: CrashType,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Extract contextual information from crash data."""
        context: Dict[str, Any] = {
            "crash_type": crash_type.value,
            "data_length": len(crash_data),
            "line_count": crash_data.count("\n") + 1,
        }

        if crash_type == CrashType.PYTHON_TRACEBACK:
            context.update(self._extract_python_context(crash_data))
        elif crash_type == CrashType.NODEJS_ERROR:
            context.update(self._extract_nodejs_context(crash_data))
        elif crash_type == CrashType.SEGFAULT:
            context["signal"] = "SIGSEGV"
            context["likely_cause"] = "memory access violation"
        elif crash_type == CrashType.OOM:
            context["likely_cause"] = "memory exhaustion"

        if metadata:
            context["metadata"] = metadata

        return context

    def identify_root_cause(
        self,
        crash_data: str,
        crash_type: CrashType,
    ) -> Optional[str]:
        """Attempt to identify the root cause of a crash."""
        if crash_type == CrashType.PYTHON_TRACEBACK:
            return self._analyze_python_root_cause(crash_data)
        elif crash_type == CrashType.NODEJS_ERROR:
            return self._analyze_nodejs_root_cause(crash_data)
        elif crash_type == CrashType.SEGFAULT:
            return "Memory access violation - possible null pointer dereference or buffer overflow"
        elif crash_type == CrashType.OOM:
            return "System ran out of available memory - possible memory leak or excessive allocation"
        elif crash_type == CrashType.TIMEOUT:
            return "Operation exceeded time limit - possible deadlock or resource contention"
        return None

    def get_crash_timeline(self, crash_data: str) -> List[Dict[str, Any]]:
        """Build a timeline of events from crash data."""
        timeline: List[Dict[str, Any]] = []
        timestamp_patterns = [
            r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})",
            r"(\d{2}:\d{2}:\d{2}\.\d+)",
        ]

        lines = crash_data.split("\n")
        for line in lines:
            for pattern in timestamp_patterns:
                match = re.search(pattern, line)
                if match:
                    timeline.append({
                        "timestamp": match.group(1),
                        "event": line.strip(),
                        "type": "crash_event",
                    })
                    break

        if not timeline:
            timeline.append({
                "timestamp": datetime.utcnow().isoformat(),
                "event": "Crash detected",
                "type": "detection",
            })

        return timeline

    def export_report(self, report: CrashReport, format: str = "dict") -> Any:
        """Export a crash report in the specified format.

        Args:
            report: The CrashReport to export.
            format: Output format - 'dict', 'text', or 'json'.

        Returns:
            Formatted report data.
        """
        if format == "text":
            return report.to_forensics_report()
        elif format == "json":
            import json
            return json.dumps(report.to_dict(), indent=2, default=str)
        return report.to_dict()

    def get_crash_history(self) -> List[CrashReport]:
        """Return all analyzed crashes."""
        return self._crash_history

    def _detect_crash_type(self, crash_data: str) -> CrashType:
        """Auto-detect the type of crash from raw data."""
        for pattern in self._patterns["python"]:
            if re.search(pattern, crash_data, re.MULTILINE):
                return CrashType.PYTHON_TRACEBACK

        for pattern in self._patterns["nodejs"]:
            if re.search(pattern, crash_data, re.MULTILINE):
                return CrashType.NODEJS_ERROR

        for pattern in self._patterns["segfault"]:
            if re.search(pattern, crash_data, re.IGNORECASE):
                return CrashType.SEGFAULT

        for pattern in self._patterns["oom"]:
            if re.search(pattern, crash_data, re.IGNORECASE):
                return CrashType.OOM

        return CrashType.GENERIC_CRASH

    def _extract_error_type(self, crash_data: str, crash_type: CrashType) -> str:
        """Extract the specific error type from crash data."""
        if crash_type == CrashType.PYTHON_TRACEBACK:
            match = re.search(r"^(\w+(?:Error|Exception)):", crash_data, re.MULTILINE)
            if match:
                return match.group(1)
            return "PythonError"
        elif crash_type == CrashType.NODEJS_ERROR:
            match = re.search(r"^(\w*Error):", crash_data, re.MULTILINE)
            if match:
                return match.group(1)
            return "NodeError"
        elif crash_type == CrashType.SEGFAULT:
            return "SegmentationFault"
        elif crash_type == CrashType.OOM:
            return "OutOfMemoryError"
        return "UnknownError"

    def _extract_python_context(self, crash_data: str) -> Dict[str, Any]:
        """Extract Python-specific context from a traceback."""
        context: Dict[str, Any] = {}
        file_matches = re.findall(r'File "([^"]+)", line (\d+)', crash_data)
        if file_matches:
            context["files_involved"] = [
                {"file": f, "line": int(l)} for f, l in file_matches
            ]
            context["origin_file"] = file_matches[-1][0]
            context["origin_line"] = int(file_matches[-1][1])

        func_matches = re.findall(r"in (\w+)", crash_data)
        if func_matches:
            context["call_chain"] = func_matches

        return context

    def _extract_nodejs_context(self, crash_data: str) -> Dict[str, Any]:
        """Extract Node.js-specific context from an error."""
        context: Dict[str, Any] = {}
        at_matches = re.findall(r"at\s+(\S+)\s+\(([^)]+)\)", crash_data)
        if at_matches:
            context["call_stack"] = [
                {"function": func, "location": loc} for func, loc in at_matches
            ]
            context["origin_function"] = at_matches[0][0]
            context["origin_location"] = at_matches[0][1]

        module_matches = re.findall(r"node_modules/([^/]+)", crash_data)
        if module_matches:
            context["involved_modules"] = list(set(module_matches))

        return context

    def _analyze_python_root_cause(self, crash_data: str) -> Optional[str]:
        """Analyze root cause for Python tracebacks."""
        last_line_match = re.search(
            r"^(\w+(?:Error|Exception)):\s*(.+)$", crash_data, re.MULTILINE
        )
        if last_line_match:
            error_class = last_line_match.group(1)
            message = last_line_match.group(2)

            if error_class == "ImportError":
                return f"Missing module or import failure: {message}"
            elif error_class == "AttributeError":
                return f"Attribute access on incompatible type: {message}"
            elif error_class == "TypeError":
                return f"Type mismatch in operation: {message}"
            elif error_class == "KeyError":
                return f"Missing dictionary key: {message}"
            elif error_class == "ValueError":
                return f"Invalid value encountered: {message}"
            elif error_class == "ConnectionError":
                return f"Network connectivity failure: {message}"
            elif error_class == "TimeoutError":
                return f"Operation timed out: {message}"
            return f"{error_class}: {message}"
        return None

    def _analyze_nodejs_root_cause(self, crash_data: str) -> Optional[str]:
        """Analyze root cause for Node.js errors."""
        error_match = re.search(r"^(\w*Error):\s*(.+)$", crash_data, re.MULTILINE)
        if error_match:
            error_class = error_match.group(1)
            message = error_match.group(2)

            if error_class == "TypeError":
                if "undefined" in message:
                    return f"Null/undefined access: {message}"
                return f"Type mismatch: {message}"
            elif error_class == "ReferenceError":
                return f"Undefined variable access: {message}"
            elif error_class == "SyntaxError":
                return f"Code syntax issue: {message}"
            elif "ECONNREFUSED" in message:
                return f"Connection refused - target service unavailable: {message}"
            elif "ENOENT" in message:
                return f"File or path not found: {message}"
            return f"{error_class}: {message}"
        return None

    def _identify_affected_systems(
        self, crash_data: str, context: Dict[str, Any]
    ) -> List[str]:
        """Identify which systems are affected by the crash."""
        affected: List[str] = []

        system_indicators = {
            "database": [r"sql", r"database", r"db\.", r"query", r"postgres", r"mysql", r"mongo"],
            "network": [r"http", r"socket", r"connection", r"request", r"tcp", r"udp"],
            "filesystem": [r"file", r"path", r"directory", r"read", r"write", r"ENOENT"],
            "memory": [r"memory", r"heap", r"allocation", r"buffer"],
            "authentication": [r"auth", r"token", r"credential", r"permission", r"denied"],
            "api": [r"api", r"endpoint", r"route", r"handler"],
            "queue": [r"queue", r"message", r"broker", r"rabbit", r"kafka"],
            "cache": [r"cache", r"redis", r"memcache"],
        }

        crash_lower = crash_data.lower()
        for system, patterns in system_indicators.items():
            for pattern in patterns:
                if re.search(pattern, crash_lower):
                    affected.append(system)
                    break

        if not affected:
            affected.append("application")

        return affected

    def _assess_severity(
        self,
        crash_data: str,
        crash_type: CrashType,
        affected_systems: List[str],
    ) -> CrashSeverity:
        """Assess the severity of a crash."""
        if crash_type == CrashType.SEGFAULT:
            return CrashSeverity.CRITICAL
        elif crash_type == CrashType.OOM:
            return CrashSeverity.CRITICAL

        critical_systems = {"database", "authentication", "network"}
        if critical_systems.intersection(set(affected_systems)):
            return CrashSeverity.HIGH

        if len(affected_systems) > 3:
            return CrashSeverity.HIGH

        if crash_type == CrashType.UNHANDLED_EXCEPTION:
            return CrashSeverity.MEDIUM

        return CrashSeverity.MEDIUM

    def _suggest_recovery(
        self, crash_type: CrashType, root_cause: Optional[str]
    ) -> List[str]:
        """Suggest recovery actions based on crash analysis."""
        actions: List[str] = []

        if crash_type == CrashType.OOM:
            actions.extend([
                "Increase memory limits or add swap space",
                "Profile memory usage to identify leaks",
                "Implement memory-bounded data structures",
                "Add memory pressure monitoring",
            ])
        elif crash_type == CrashType.SEGFAULT:
            actions.extend([
                "Check for null pointer dereferences",
                "Validate buffer boundaries",
                "Run with address sanitizer enabled",
                "Review recent native code changes",
            ])
        elif crash_type == CrashType.TIMEOUT:
            actions.extend([
                "Increase timeout thresholds",
                "Check for deadlocks or resource contention",
                "Add circuit breakers for external calls",
                "Profile slow operations",
            ])
        else:
            actions.extend([
                "Review stack trace for immediate fix",
                "Add error handling around failure point",
                "Implement retry logic if transient",
                "Add monitoring for early detection",
            ])

        return actions
