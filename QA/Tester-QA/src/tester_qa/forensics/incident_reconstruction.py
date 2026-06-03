"""Incident Reconstruction Module - Complete forensic incident reconstruction."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class IncidentSeverity(Enum):
    """Incident severity levels."""
    P1_CRITICAL = "P1 - Critical"
    P2_HIGH = "P2 - High"
    P3_MEDIUM = "P3 - Medium"
    P4_LOW = "P4 - Low"


class IncidentStatus(Enum):
    """Incident status."""
    INVESTIGATING = "investigating"
    IDENTIFIED = "identified"
    MITIGATING = "mitigating"
    RESOLVED = "resolved"
    POSTMORTEM = "postmortem"


@dataclass
class FailureChainLink:
    """A single link in the failure propagation chain."""
    step: int
    timestamp: datetime
    component: str
    event: str
    effect: str
    cause_of_next: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Export link as dictionary."""
        return {
            "step": self.step,
            "timestamp": self.timestamp.isoformat(),
            "component": self.component,
            "event": self.event,
            "effect": self.effect,
            "cause_of_next": self.cause_of_next,
        }


@dataclass
class AffectedSystem:
    """Information about an affected system."""
    name: str
    impact: str
    duration_seconds: Optional[float]
    recovery_time: Optional[datetime]
    status: str
    users_affected: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Export as dictionary."""
        return {
            "name": self.name,
            "impact": self.impact,
            "duration_seconds": self.duration_seconds,
            "recovery_time": self.recovery_time.isoformat() if self.recovery_time else None,
            "status": self.status,
            "users_affected": self.users_affected,
        }


@dataclass
class IncidentReport:
    """Complete incident forensic report."""
    incident_id: str
    title: str
    status: IncidentStatus
    severity: IncidentSeverity
    what_failed: str
    when_occurred: datetime
    why_happened: Optional[str]
    what_triggered: Optional[str]
    affected_systems: List[AffectedSystem]
    failure_chain: List[FailureChainLink]
    detection_time: datetime
    resolution_time: Optional[datetime]
    timeline: List[Dict[str, Any]]
    root_cause: Optional[str]
    impact_summary: Dict[str, Any]
    lessons_learned: List[str]
    prevention_actions: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Export report as dictionary."""
        return {
            "incident_id": self.incident_id,
            "title": self.title,
            "status": self.status.value,
            "severity": self.severity.value,
            "what_failed": self.what_failed,
            "when_occurred": self.when_occurred.isoformat(),
            "why_happened": self.why_happened,
            "what_triggered": self.what_triggered,
            "affected_systems": [a.to_dict() for a in self.affected_systems],
            "failure_chain": [f.to_dict() for f in self.failure_chain],
            "detection_time": self.detection_time.isoformat(),
            "resolution_time": self.resolution_time.isoformat() if self.resolution_time else None,
            "timeline": self.timeline,
            "root_cause": self.root_cause,
            "impact_summary": self.impact_summary,
            "lessons_learned": self.lessons_learned,
            "prevention_actions": self.prevention_actions,
            "metadata": self.metadata,
        }

    def to_forensics_report(self) -> str:
        """Export as human-readable forensics report."""
        lines = [
            "=" * 70,
            "INCIDENT FORENSIC REPORT",
            "=" * 70,
            f"Incident ID:  {self.incident_id}",
            f"Title:       {self.title}",
            f"Status:      {self.status.value}",
            f"Severity:    {self.severity.value}",
            "",
            "-" * 70,
            "THE 5 Ws OF THIS INCIDENT",
            "-" * 70,
            f"WHAT FAILED:      {self.what_failed}",
            f"WHEN:             {self.when_occurred.isoformat()}",
            f"WHY:              {self.why_happened or 'Under investigation'}",
            f"WHAT TRIGGERED:   {self.what_triggered or 'Unknown'}",
            "",
            "AFFECTED SYSTEMS:",
        ]

        for sys in self.affected_systems:
            lines.append(f"  - {sys.name} ({sys.impact}) - {sys.users_affected} users affected")

        lines.extend(["", "FAILURE PROPAGATION CHAIN:"])
        for link in self.failure_chain:
            lines.append(f"  Step {link.step}: [{link.component}] {link.event}")
            lines.append(f"           Effect: {link.effect}")

        if self.timeline:
            lines.extend(["", "TIMELINE:"])
            for entry in self.timeline:
                lines.append(f"  [{entry.get('timestamp', '')}] {entry.get('description', '')}")

        if self.root_cause:
            lines.extend(["", f"ROOT CAUSE: {self.root_cause}"])

        if self.lessons_learned:
            lines.extend(["", "LESSONS LEARNED:"])
            for i, lesson in enumerate(self.lessons_learned, 1):
                lines.append(f"  {i}. {lesson}")

        if self.prevention_actions:
            lines.extend(["", "PREVENTION ACTIONS:"])
            for i, action in enumerate(self.prevention_actions, 1):
                lines.append(f"  {i}. {action}")

        lines.extend(["", "IMPACT SUMMARY:"])
        for key, value in self.impact_summary.items():
            lines.append(f"  {key}: {value}")

        lines.append("=" * 70)
        return "".join(lines)


class IncidentReconstructor:
    """Reconstructs complete incident timelines from forensic data."""

    def __init__(self) -> None:
        self._reports: List[IncidentReport] = []
        self._report_counter: int = 0

    def reconstruct_incident(
        self,
        crash_data: Optional[str] = None,
        trace_data: Optional[str] = None,
        timeline_data: Optional[List[Dict[str, Any]]] = None,
        snapshot_before: Optional[Dict[str, Any]] = None,
        snapshot_after: Optional[Dict[str, Any]] = None,
        custom_context: Optional[Dict[str, Any]] = None,
    ) -> IncidentReport:
        """Reconstruct an incident from available forensic data.

        Args:
            crash_data: Optional raw crash data.
            trace_data: Optional execution trace log data.
            timeline_data: Optional list of timeline events.
            snapshot_before: Optional system state before incident.
            snapshot_after: Optional system state after incident.
            custom_context: Optional custom incident context.

        Returns:
            Complete IncidentReport.
        """
        self._report_counter += 1
        incident_id = f"INC-{datetime.utcnow().strftime('%Y%m%d')}-{self._report_counter:04d}"

        what_failed = self._determine_what_failed(crash_data, custom_context)
        when_occurred = self._determine_when(crash_data, trace_data, timeline_data, custom_context)
        why_happened = self._determine_why(crash_data, trace_data, custom_context)
        what_triggered = self._determine_trigger(crash_data, trace_data, timeline_data, custom_context)
        affected_systems = self._identify_affected_systems(
            crash_data, snapshot_before, snapshot_after, custom_context
        )
        failure_chain = self.build_failure_chain(
            timeline_data, trace_data, crash_data, custom_context
        )
        severity = self._assess_incident_severity(affected_systems, failure_chain)
        status = self._determine_status(failure_chain, affected_systems)
        root_cause = self._determine_root_cause(
            what_failed, why_happened, failure_chain, crash_data
        )
        impact_summary = self._calculate_impact(
            affected_systems, failure_chain, when_occurred
        )
        lessons = self._generate_lessons(root_cause, affected_systems, failure_chain)
        prevention = self._generate_prevention_actions(root_cause, lessons)
        metadata = self._build_metadata(
            crash_data, trace_data, snapshot_before, snapshot_after
        )

        timeline = timeline_data or self._build_timeline_from_data(
            crash_data, trace_data, timeline_data
        )

        report = IncidentReport(
            incident_id=incident_id,
            title=f"Incident: {what_failed}",
            status=status,
            severity=severity,
            what_failed=what_failed,
            when_occurred=when_occurred,
            why_happened=why_happened,
            what_triggered=what_triggered,
            affected_systems=affected_systems,
            failure_chain=failure_chain,
            detection_time=self._estimate_detection_time(when_occurred, timeline),
            resolution_time=None,
            timeline=timeline,
            root_cause=root_cause,
            impact_summary=impact_summary,
            lessons_learned=lessons,
            prevention_actions=prevention,
            metadata=metadata,
        )

        self._reports.append(report)
        return report

    def build_failure_chain(
        self,
        timeline_data: Optional[List[Dict[str, Any]]] = None,
        trace_data: Optional[str] = None,
        crash_data: Optional[str] = None,
        custom_context: Optional[Dict[str, Any]] = None,
    ) -> List[FailureChainLink]:
        """Build the failure propagation chain.

        Args:
            timeline_data: Optional list of timeline events.
            trace_data: Optional execution trace.
            crash_data: Optional crash data.
            custom_context: Optional custom context.

        Returns:
            List of FailureChainLink objects forming the chain.
        """
        chain: List[FailureChainLink] = []
        step_counter = 1

        if timeline_data:
            for i, event in enumerate(timeline_data):
                if event.get("type") in ("error", "failure", "cascade", "trigger"):
                    chain.append(FailureChainLink(
                        step=step_counter,
                        timestamp=datetime.fromisoformat(event.get("timestamp", datetime.utcnow().isoformat())),
                        component=event.get("source", "unknown"),
                        event=event.get("description", event.get("event", "Unknown event")),
                        effect=self._infer_effect(event),
                        cause_of_next=None,
                    ))
                    step_counter += 1

        if len(chain) < 2 and crash_data:
            chain.append(FailureChainLink(
                step=step_counter,
                timestamp=datetime.utcnow(),
                component="application",
                event="Process crashed",
                effect="Service became unavailable",
                cause_of_next="Complete service outage",
            ))
            step_counter += 1

        if len(chain) < 2:
            chain.append(FailureChainLink(
                step=step_counter,
                timestamp=datetime.utcnow(),
                component="system",
                event="Failure detected",
                effect="Investigation required",
            ))

        for i in range(len(chain) - 1):
            chain[i].cause_of_next = chain[i + 1].effect

        return chain

    def generate_incident_report(
        self,
        incident: IncidentReport,
        format: str = "report",
    ) -> Any:
        """Generate a formatted incident report.

        Args:
            incident: The IncidentReport to format.
            format: Output format - 'report', 'dict', 'json', or 'markdown'.

        Returns:
            Formatted report.
        """
        if format == "report":
            return incident.to_forensics_report()
        elif format == "markdown":
            return self._format_markdown(incident)
        elif format == "json":
            import json
            return json.dumps(incident.to_dict(), indent=2, default=str)
        return incident.to_dict()

    def get_reports(self) -> List[IncidentReport]:
        """Return all generated incident reports."""
        return self._reports.copy()

    def _determine_what_failed(
        self,
        crash_data: Optional[str],
        context: Optional[Dict[str, Any]],
    ) -> str:
        """Determine what failed in the incident."""
        if context and context.get("component"):
            return context["component"]

        if crash_data:
            if "Segmentation fault" in crash_data or "SIGSEGV" in crash_data:
                return "Memory subsystem - invalid memory access"
            elif "Out of memory" in crash_data or "MemoryError" in crash_data:
                return "Memory subsystem - memory exhaustion"
            elif "Connection refused" in crash_data:
                return "Network connectivity - connection failure"
            elif "timeout" in crash_data.lower():
                return "Timeout - operation exceeded time limit"
            elif "Exception" in crash_data or "Error" in crash_data:
                return "Application - unhandled exception"

        return "Unknown component - investigation required"

    def _determine_when(
        self,
        crash_data: Optional[str],
        trace_data: Optional[str],
        timeline_data: Optional[List[Dict[str, Any]]],
        context: Optional[Dict[str, Any]],
    ) -> datetime:
        """Determine when the incident occurred."""
        if timeline_data and len(timeline_data) > 0:
            first = timeline_data[0]
            ts_str = first.get("timestamp")
            if ts_str:
                try:
                    return datetime.fromisoformat(ts_str)
                except (ValueError, TypeError):
                    pass

        if context and context.get("timestamp"):
            return context["timestamp"]

        return datetime.utcnow()

    def _determine_why(
        self,
        crash_data: Optional[str],
        trace_data: Optional[str],
        context: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        """Determine why the incident happened."""
        if context and context.get("root_cause"):
            return context["root_cause"]

        if crash_data:
            if "ImportError" in crash_data:
                return "A required module or dependency was not available"
            elif "PermissionError" in crash_data or "AccessDenied" in crash_data:
                return "Insufficient permissions to perform the required operation"
            elif "Connection refused" in crash_data:
                return "Target service was not accepting connections"
            elif "timeout" in crash_data.lower():
                return "Operation did not complete within the expected time window"
            elif "Out of memory" in crash_data:
                return "Process consumed all available memory"

        return None

    def _determine_trigger(
        self,
        crash_data: Optional[str],
        trace_data: Optional[str],
        timeline_data: Optional[List[Dict[str, Any]]],
        context: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        """Determine what triggered the incident."""
        if context and context.get("trigger"):
            return context["trigger"]

        if trace_data:
            if "request" in trace_data.lower():
                return "Incoming user request"
            elif "cron" in trace_data.lower() or "scheduled" in trace_data.lower():
                return "Scheduled job execution"
            elif "deploy" in trace_data.lower():
                return "Deployment or configuration change"

        if timeline_data:
            triggers = [e for e in timeline_data if e.get("type") == "trigger"]
            if triggers:
                return triggers[0].get("description", "Trigger identified in timeline")

        return None

    def _identify_affected_systems(
        self,
        crash_data: Optional[str],
        before: Optional[Dict[str, Any]],
        after: Optional[Dict[str, Any]],
        context: Optional[Dict[str, Any]],
    ) -> List[AffectedSystem]:
        """Identify all systems affected by the incident."""
        systems: List[AffectedSystem] = []

        affected_names: Set[str] = set()

        if context and context.get("affected_systems"):
            for name in context["affected_systems"]:
                systems.append(AffectedSystem(
                    name=name,
                    impact="Direct",
                    duration_seconds=None,
                    recovery_time=None,
                    status="affected",
                ))
                affected_names.add(name)

        if before and after:
            added_keys = set(after.keys()) - set(before.keys())
            if added_keys:
                for key in list(added_keys)[:5]:
                    if key not in affected_names:
                        systems.append(AffectedSystem(
                            name=key,
                            impact="State changed",
                            duration_seconds=None,
                            recovery_time=None,
                            status="changed",
                        ))
                        affected_names.add(key)

        if crash_data:
            crash_lower = crash_data.lower()
            if "database" in crash_lower or "sql" in crash_lower or "query" in crash_lower:
                if "database" not in affected_names:
                    systems.append(AffectedSystem(
                        name="database",
                        impact="Query failures",
                        duration_seconds=None,
                        recovery_time=None,
                        status="affected",
                    ))
                    affected_names.add("database")
            if "http" in crash_lower or "network" in crash_lower or "connection" in crash_lower:
                if "network" not in affected_names:
                    systems.append(AffectedSystem(
                        name="network",
                        impact="Connectivity issues",
                        duration_seconds=None,
                        recovery_time=None,
                        status="affected",
                    ))
                    affected_names.add("network")
            if "redis" in crash_lower or "cache" in crash_lower:
                if "cache" not in affected_names:
                    systems.append(AffectedSystem(
                        name="cache",
                        impact="Cache unavailability",
                        duration_seconds=None,
                        recovery_time=None,
                        status="affected",
                    ))

        if not systems:
            systems.append(AffectedSystem(
                name="application",
                impact="Service degradation",
                duration_seconds=None,
                recovery_time=None,
                status="affected",
            ))

        return systems

    def _build_failure_chain(
        self,
        timeline_data: Optional[List[Dict[str, Any]]],
        trace_data: Optional[str],
        crash_data: Optional[str],
        context: Optional[Dict[str, Any]],
    ) -> List[FailureChainLink]:
        """Build failure chain - delegated to public method for compatibility."""
        return self.build_failure_chain(timeline_data, trace_data, crash_data, context)

    def _assess_incident_severity(
        self,
        affected_systems: List[AffectedSystem],
        failure_chain: List[FailureChainLink],
    ) -> IncidentSeverity:
        """Assess the severity of the incident."""
        critical_systems = {"database", "authentication", "payment", "core-api"}
        affected_names = {s.name.lower() for s in affected_systems}

        if critical_systems.intersection(affected_names):
            return IncidentSeverity.P1_CRITICAL

        if len(affected_systems) >= 3:
            return IncidentSeverity.P1_CRITICAL

        if len(affected_systems) >= 2:
            return IncidentSeverity.P2_HIGH

        if len(failure_chain) >= 5:
            return IncidentSeverity.P2_HIGH

        if affected_systems:
            return IncidentSeverity.P3_MEDIUM

        return IncidentSeverity.P4_LOW

    def _determine_status(
        self,
        failure_chain: List[FailureChainLink],
        affected_systems: List[AffectedSystem],
    ) -> IncidentStatus:
        """Determine current incident status."""
        if len(failure_chain) == 0:
            return IncidentStatus.INVESTIGATING

        has_resolution = any("recovery" in link.effect.lower() or "resolved" in link.effect.lower() for link in failure_chain)

        if has_resolution:
            return IncidentStatus.RESOLVED

        return IncidentStatus.IDENTIFIED

    def _determine_root_cause(
        self,
        what_failed: str,
        why_happened: Optional[str],
        failure_chain: List[FailureChainLink],
        crash_data: Optional[str],
    ) -> Optional[str]:
        """Determine the root cause of the incident."""
        if why_happened:
            return why_happened

        if failure_chain:
            first_link = failure_chain[0]
            return f"{first_link.component} experienced {first_link.event.lower()}, leading to cascading failures"

        if crash_data:
            return f"Unhandled error in {what_failed}"

        return None

    def _calculate_impact(
        self,
        affected_systems: List[AffectedSystem],
        failure_chain: List[FailureChainLink],
        when_occurred: datetime,
    ) -> Dict[str, Any]:
        """Calculate incident impact metrics."""
        total_users = sum(s.users_affected for s in affected_systems)
        systems_affected = len(affected_systems)
        chain_depth = len(failure_chain)

        impact_level = "low"
        if systems_affected >= 3 or total_users > 1000:
            impact_level = "high"
        elif systems_affected >= 2 or total_users > 100:
            impact_level = "medium"

        return {
            "impact_level": impact_level,
            "systems_affected": systems_affected,
            "users_affected_estimate": total_users if total_users > 0 else "unknown",
            "failure_chain_depth": chain_depth,
            "estimated_downtime_minutes": (datetime.utcnow() - when_occurred).total_seconds() / 60,
        }

    def _generate_lessons(
        self,
        root_cause: Optional[str],
        affected_systems: List[AffectedSystem],
        failure_chain: List[FailureChainLink],
    ) -> List[str]:
        """Generate lessons learned from the incident."""
        lessons: List[str] = []

        if root_cause:
            lessons.append(f"Root cause analysis revealed: {root_cause}")

        if len(failure_chain) > 3:
            lessons.append("Cascading failures indicate need for better circuit breakers and isolation")

        affected_names = {s.name for s in affected_systems}
        if "database" in affected_names:
            lessons.append("Database dependency should have fallback or connection pooling")
        if "network" in affected_names:
            lessons.append("Network resilience patterns (retries, fallbacks) need implementation")

        lessons.append("Early detection systems could have reduced time to identify the issue")

        return lessons

    def _generate_prevention_actions(
        self,
        root_cause: Optional[str],
        lessons: List[str],
    ) -> List[str]:
        """Generate prevention actions."""
        actions: List[str] = []

        if root_cause and "memory" in root_cause.lower():
            actions.append("Implement memory monitoring and alerting thresholds")
            actions.append("Add memory profiling to regular testing")
        if root_cause and "timeout" in root_cause.lower():
            actions.append("Review and increase timeout configurations where appropriate")
            actions.append("Implement circuit breakers for external dependencies")
        if root_cause and "connection" in root_cause.lower():
            actions.append("Add connection health checks and automatic reconnection")
            actions.append("Implement retry logic with exponential backoff")

        actions.append("Add monitoring dashboards for all affected components")
        actions.append("Document runbooks for common failure scenarios")

        return actions

    def _build_metadata(
        self,
        crash_data: Optional[str],
        trace_data: Optional[str],
        snapshot_before: Optional[Dict[str, Any]],
        snapshot_after: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Build metadata dictionary."""
        metadata: Dict[str, Any] = {}

        if crash_data:
            metadata["crash_data_length"] = len(crash_data)
            metadata["has_crash_data"] = True
        if trace_data:
            metadata["trace_data_length"] = len(trace_data)
            metadata["has_trace_data"] = True
        if snapshot_before:
            metadata["has_before_snapshot"] = True
        if snapshot_after:
            metadata["has_after_snapshot"] = True

        return metadata

    def _build_timeline_from_data(
        self,
        crash_data: Optional[str],
        trace_data: Optional[str],
        timeline_data: Optional[List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        """Build timeline from raw data."""
        if timeline_data:
            return timeline_data

        events: List[Dict[str, Any]] = []

        if crash_data:
            events.append({
                "timestamp": datetime.utcnow().isoformat(),
                "description": "Crash detected",
                "type": "failure",
                "source": "system",
            })

        return events

    def _estimate_detection_time(
        self,
        when_occurred: datetime,
        timeline: List[Dict[str, Any]],
    ) -> datetime:
        """Estimate when the incident was detected."""
        if timeline:
            for event in timeline:
                if event.get("type") in ("alert", "detection", "notification"):
                    try:
                        return datetime.fromisoformat(event.get("timestamp", when_occurred.isoformat()))
                    except (ValueError, TypeError):
                        pass

        detection_delay_minutes = 2.0
        return datetime.fromtimestamp(when_occurred.timestamp() + detection_delay_minutes * 60)

    def _infer_effect(self, event: Dict[str, Any]) -> str:
        """Infer the effect of an event."""
        event_type = event.get("type", "")
        description = event.get("description", "")

        if event_type == "error" or "error" in description.lower():
            return "Error returned to caller"
        elif event_type == "failure" or "fail" in description.lower():
            return "Component became unavailable"
        elif event_type == "timeout" or "timeout" in description.lower():
            return "Operation did not complete"
        elif event_type == "cascade" or "cascade" in description.lower():
            return "Failure spread to dependent systems"
        elif event_type == "recovery" or "recover" in description.lower():
            return "Service restored"

        return "Effect under investigation"

    def _format_markdown(self, incident: IncidentReport) -> str:
        """Format incident report as Markdown."""
        lines = [
            f"# {incident.title}",
            f"**Incident ID:** {incident.incident_id}  ",
            f"**Status:** {incident.status.value} | **Severity:** {incident.severity.value}  ",
            "",
            "## What Failed",
            incident.what_failed,
            "",
            "## When",
            incident.when_occurred.isoformat(),
            "",
            "## Why",
            incident.why_happened or "Under investigation",
            "",
            "## What Triggered",
            incident.what_triggered or "Unknown",
            "",
            "## Affected Systems",
        ]

        for sys in incident.affected_systems:
            lines.append(f"- **{sys.name}**: {sys.impact} ({sys.users_affected} users)")

        lines.extend(["", "## Failure Propagation Chain", ""])
        for link in incident.failure_chain:
            lines.append(f"{link.step}. [{link.component}] {link.event} -> {link.effect}")

        if incident.root_cause:
            lines.extend(["", "## Root Cause", incident.root_cause])

        if incident.lessons_learned:
            lines.extend(["", "## Lessons Learned", ""])
            for lesson in incident.lessons_learned:
                lines.append(f"- {lesson}")

        if incident.prevention_actions:
            lines.extend(["", "## Prevention Actions", ""])
            for action in incident.prevention_actions:
                lines.append(f"- {action}")

        return "".join(lines)
