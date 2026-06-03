"""Complete warfare event reconstruction for forensics."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .warfare_timeline import WarfareTimeline, TimelineEvent
from .browser_collapse_chain import BrowserCollapseChain
from .render_failure_chain import RenderFailureChain
from .websocket_failure_chain import WebSocketFailureChain

LOGGER = logging.getLogger(__name__)


@dataclass
class WarfareReconstruction:
    session_id: str
    url: str
    scenario: str
    started_at: str
    completed_at: str = ""
    timeline: list[dict[str, Any]] = field(default_factory=list)
    timeline_summary: dict[str, Any] = field(default_factory=dict)
    collapse_analysis: dict[str, Any] = field(default_factory=dict)
    render_analysis: dict[str, Any] = field(default_factory=dict)
    websocket_analysis: dict[str, Any] = field(default_factory=dict)
    overall_severity: str = "unknown"
    forensic_score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "url": self.url,
            "scenario": self.scenario,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "timeline": self.timeline,
            "timeline_summary": self.timeline_summary,
            "collapse_analysis": self.collapse_analysis,
            "render_analysis": self.render_analysis,
            "websocket_analysis": self.websocket_analysis,
            "overall_severity": self.overall_severity,
            "forensic_score": round(self.forensic_score, 2),
        }


class WarfareReconstructor:
    """Builds complete forensic reconstruction reports from warfare evidence."""

    def __init__(self) -> None:
        self._collapse_chain = BrowserCollapseChain()
        self._render_chain = RenderFailureChain()
        self._ws_chain = WebSocketFailureChain()

    def reconstruct(
        self,
        session_id: str,
        evidence: dict[str, Any],
    ) -> WarfareReconstruction:
        """Build a complete forensic reconstruction from warfare evidence.

        Args:
            session_id: Session identifier.
            evidence: Dict containing:
                - url: target URL
                - scenario: scenario ID that was run
                - started_at: ISO timestamp
                - completed_at: ISO timestamp
                - timeline: Optional list of pre-recorded timeline events
                - module_results: Dict of module results (memory, hydration, etc.)
                - recovery_report: Optional recovery report from WarfareRecoveryValidator

        Returns:
            WarfareReconstruction with full forensic analysis.
        """
        url = evidence.get("url", "")
        scenario = evidence.get("scenario", "")
        started_at = evidence.get("started_at", datetime.now(timezone.utc).isoformat())
        completed_at = evidence.get("completed_at", datetime.now(timezone.utc).isoformat())
        timeline_data = evidence.get("timeline", [])

        # Build timeline from evidence
        timeline = self._build_timeline(session_id, evidence)

        # Run chain analyses
        collapse_analysis = self._collapse_chain.analyze(timeline)
        render_analysis = self._render_chain.analyze(timeline)
        ws_analysis = self._ws_chain.analyze(timeline)

        # Compute overall severity
        severity_levels = {"low": 0, "medium": 1, "high": 2, "extreme": 3}
        severities = [
            severity_levels.get(collapse_analysis.get("severity", "low"), 0),
            severity_levels.get(render_analysis.get("severity", "low"), 0),
            severity_levels.get(ws_analysis.get("severity", "low"), 0),
        ]
        max_severity = max(severities)
        overall_severity = next(
            (k for k, v in severity_levels.items() if v == max_severity),
            "low",
        )

        # Compute forensic score
        forensic_score = self._compute_forensic_score(
            collapse_analysis,
            render_analysis,
            ws_analysis,
        )

        LOGGER.info(
            "[Reconstructor] session=%s severity=%s forensic_score=%.1f events=%d",
            session_id, overall_severity, forensic_score, len(timeline),
        )

        return WarfareReconstruction(
            session_id=session_id,
            url=url,
            scenario=scenario,
            started_at=started_at,
            completed_at=completed_at,
            timeline=timeline,
            timeline_summary=self._summarize_timeline(timeline),
            collapse_analysis=collapse_analysis,
            render_analysis=render_analysis,
            websocket_analysis=ws_analysis,
            overall_severity=overall_severity,
            forensic_score=forensic_score,
        )

    def generate_timeline_markdown(self, reconstruction: WarfareReconstruction | dict[str, Any]) -> str:
        """Generate a human-readable forensic timeline in Markdown format.

        Args:
            reconstruction: WarfareReconstruction instance or dict.

        Returns:
            Markdown string suitable for embedding in reports.
        """
        if isinstance(reconstruction, dict):
            data = reconstruction
        else:
            data = reconstruction.to_dict()

        lines: list[str] = []
        lines.append("# Browser Warfare Forensic Report")
        lines.append("")
        lines.append(f"**Session ID:** `{data['session_id']}`")
        lines.append(f"**URL:** {data['url']}")
        lines.append(f"**Scenario:** {data['scenario']}")
        lines.append(f"**Started:** {data['started_at']}")
        lines.append(f"**Completed:** {data['completed_at']}")
        lines.append(f"**Overall Severity:** `{data['overall_severity']}`")
        lines.append(f"**Forensic Score:** `{data['forensic_score']:.1f}/100`")
        lines.append("")

        # Timeline section
        lines.append("## Warfare Timeline")
        lines.append("")
        timeline = data.get("timeline", [])
        if timeline:
            lines.append("| # | Timestamp | Event | Phase | Data |")
            lines.append("|---|-----------|-------|-------|------|")
            for i, event in enumerate(timeline):
                ts = event.get("timestamp", "")
                etype = event.get("event_type", "")
                phase = event.get("phase", "")
                data_str = str(event.get("data", {}))[:60]
                lines.append(f"| {i + 1} | {ts} | `{etype}` | {phase} | {data_str} |")
        else:
            lines.append("*No timeline events recorded.*")
        lines.append("")

        # Collapse analysis
        collapse = data.get("collapse_analysis", {})
        if collapse:
            lines.append("## Browser Collapse Analysis")
            lines.append("")
            lines.append(f"**Severity:** `{collapse.get('severity', 'unknown')}`")
            lines.append(f"**Collapse Detected:** `{collapse.get('collapse_detected', False)}`")
            lines.append(f"**Chain Length:** {len(collapse.get('chain', []))} steps")
            lines.append("")
            if collapse.get("chain"):
                lines.append("**Propagation Chain:**")
                for step in collapse["chain"]:
                    lines.append(f"  - `{step['step']}` → `{step['effect']}`")
                lines.append("")
            if collapse.get("trigger_event"):
                lines.append(f"**Trigger Event:** `{collapse['trigger_event'].get('event_type', 'unknown')}`")
                lines.append("")

        # Render analysis
        render = data.get("render_analysis", {})
        if render:
            lines.append("## Render Failure Analysis")
            lines.append("")
            lines.append(f"**Severity:** `{render.get('severity', 'unknown')}`")
            lines.append(f"**Frame Budget Exceeded:** `{render.get('frame_budget_exceeded', False)}`")
            lines.append(f"**Chain Length:** {len(render.get('chain', []))} steps")
            lines.append("")

        # WebSocket analysis
        ws = data.get("websocket_analysis", {})
        if ws:
            lines.append("## WebSocket Failure Analysis")
            lines.append("")
            lines.append(f"**Severity:** `{ws.get('severity', 'unknown')}`")
            lines.append(f"**Reconnect Storm:** `{ws.get('reconnect_storm', False)}`")
            lines.append(f"**State Desync:** `{ws.get('state_desynchronization', False)}`")
            lines.append("")

        return "\n".join(lines)

    # ─── Private helpers ─────────────────────────────────────────────────────

    def _build_timeline(self, session_id: str, evidence: dict[str, Any]) -> list[dict[str, Any]]:
        """Build a WarfareTimeline from evidence, or return raw timeline if provided."""
        timeline_obj = WarfareTimeline(session_id)

        # If timeline was already provided, just build and return
        if evidence.get("timeline"):
            return evidence["timeline"]

        # Otherwise, reconstruct from module results
        module_results = evidence.get("module_results", {})
        started_at = evidence.get("started_at")

        # Add warfare start event
        timeline_obj.add_event(
            event_type="warfare_start",
            phase="before",
            data={"url": evidence.get("url"), "scenario": evidence.get("scenario")},
            timestamp=started_at,
        )

        # Add memory events
        memory = module_results.get("memory", {})
        if memory:
            timeline_obj.add_event(
                event_type="memory_bomb",
                phase="during",
                data={
                    "bytes_allocated": memory.get("bytes_allocated", 0),
                    "closures_leaked": memory.get("closures_leaked", 0),
                    "dom_nodes_flooded": memory.get("dom_nodes_flooded", 0),
                },
            )

        # Add hydration events
        hydration = module_results.get("hydration", {})
        if hydration:
            timeline_obj.add_event(
                event_type="hydration_break",
                phase="during",
                data={
                    "mismatched_nodes": hydration.get("mismatched_nodes", 0),
                    "nodes_removed": hydration.get("nodes_removed", 0),
                    "state_corruptions": hydration.get("state_corruptions", 0),
                },
            )

        # Add render events
        render = module_results.get("render_flood", {})
        if render:
            timeline_obj.add_event(
                event_type="render_flood",
                phase="during",
                data={
                    "nodes_created": render.get("nodes_created", 0),
                    "style_bombs": render.get("style_bombs", 0),
                    "forced_reflows": render.get("forced_reflows", 0),
                },
            )

        # Add async events
        async_data = module_results.get("async_deadlock", {})
        if async_data:
            timeline_obj.add_event(
                event_type="async_deadlock",
                phase="during",
                data={
                    "chains_created": async_data.get("chains_created", 0),
                    "rejections_thrown": async_data.get("rejections_thrown", 0),
                },
            )

        # Add websocket events
        ws = module_results.get("websocket", {})
        if ws:
            timeline_obj.add_event(
                event_type="websocket_flood",
                phase="during",
                data={
                    "connections_opened": ws.get("connections_opened", 0),
                    "messages_sent": ws.get("messages_sent", 0),
                    "corrupt_messages": ws.get("corrupt_messages", 0),
                },
            )

        # Add navigation events
        nav = module_results.get("navigation", {})
        if nav:
            timeline_obj.add_event(
                event_type="navigation_loop",
                phase="during",
                data={
                    "history_entries_added": nav.get("history_entries_added", 0),
                    "memory_leaks_detected": nav.get("memory_leaks_detected", 0),
                },
            )

        # Add recovery event if present
        recovery_report = evidence.get("recovery_report", {})
        if recovery_report:
            timeline_obj.add_recovery_event(
                recovery_score=recovery_report.get("overall_score", 0.0),
                details={
                    "memory_score": recovery_report.get("memory_score", 0.0),
                    "dom_score": recovery_report.get("dom_score", 0.0),
                    "state_score": recovery_report.get("state_score", 0.0),
                },
            )

        # Add collapse event if detected
        if collapse_pt := timeline_obj.detect_collapse_point():
            timeline_obj.add_collapse_event(
                collapse_type="browser_collapse",
                evidence=collapse_pt,
            )

        return timeline_obj.build()

    @staticmethod
    def _summarize_timeline(timeline: list[dict[str, Any]]) -> dict[str, Any]:
        if not timeline:
            return {}
        t = WarfareTimeline(session_id="")
        # Reconstruct from raw data for summarization
        return {
            "total_events": len(timeline),
            "event_types": list({e.get("event_type") for e in timeline}),
            "phases": list({e.get("phase") for e in timeline}),
            "first_event": timeline[0].get("timestamp", ""),
            "last_event": timeline[-1].get("timestamp", ""),
        }

    @staticmethod
    def _compute_forensic_score(
        collapse: dict[str, Any],
        render: dict[str, Any],
        ws: dict[str, Any],
    ) -> float:
        """Compute a forensic score 0–100 indicating how well the collapse was characterised."""
        score = 0.0

        # Credit for having chain data
        if collapse.get("chain"):
            score += 30.0
        if render.get("chain"):
            score += 20.0
        if ws.get("chain"):
            score += 20.0

        # Credit for trigger identification
        if collapse.get("trigger_event"):
            score += 10.0
        if render.get("trigger_event"):
            score += 5.0
        if ws.get("trigger_event"):
            score += 5.0

        # Penalty for not detecting collapse
        if not collapse.get("collapse_detected"):
            score -= 20.0

        # Credit for severity assessment
        severity_vals = {"low": 5, "medium": 10, "high": 15, "extreme": 20}
        for analysis in [collapse, render, ws]:
            sev = analysis.get("severity", "low")
            score += severity_vals.get(sev, 0)

        return max(0.0, min(100.0, score))
