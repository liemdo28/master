"""War Room Executive Report — SRE Briefing Format.

Reports feel like:
- SRE war-room briefings
- disaster reconstruction reports
- cyber range intelligence dossiers
- operational collapse investigations
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def render_warroom_executive_report(
    status: str,
    scores: dict[str, float],
    runtime: dict[str, Any],
    providers: list[dict[str, Any]],
    browser: dict[str, Any],
    incidents: dict[str, Any],
    alerts: list[dict[str, Any]],
    failure_chain: Optional[list[str]] = None,
    blast_radius: Optional[dict[str, Any]] = None,
    recovery_analysis: Optional[dict[str, Any]] = None,
    architecture_weakness: Optional[list[str]] = None,
    recommendations: Optional[list[str]] = None,
) -> str:
    """Generate executive war room report in SRE briefing format."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines = []

    # Header
    lines.append("═" * 72)
    lines.append("  TESTER-QA — EXECUTIVE WAR ROOM BRIEFING")
    lines.append(f"  Generated: {now}")
    lines.append(f"  System Status: {status.upper()}")
    lines.append("═" * 72)
    lines.append("")

    # Executive Summary
    lines.append("┌─ EXECUTIVE SUMMARY ─────────────────────────────────────────────────┐")
    survival = scores.get("production_survival", 0)
    risk = scores.get("operational_risk", 0)
    collapse = scores.get("collapse_probability", 0)
    lines.append(f"│  Production Survival Score:  {survival:.1f}/100")
    lines.append(f"│  Operational Risk:           {risk:.1f}/100")
    lines.append(f"│  Collapse Probability:       {collapse:.1f}%")
    lines.append(f"│  Active Incidents:           {incidents.get('open_incidents', 0)}")
    lines.append(f"│  Critical Incidents:         {incidents.get('critical_incidents', 0)}")
    lines.append(f"│  Active Collapse:            {'YES' if incidents.get('active_collapse') else 'NO'}")
    lines.append("└──────────────────────────────────────────────────────────────────────┘")
    lines.append("")

    # Operational Risk
    lines.append("┌─ OPERATIONAL RISK ────────────────────────────────────────────────────┐")
    for key, value in scores.items():
        label = key.replace("_", " ").title()
        bar_len = int(value / 100 * 30)
        bar = "█" * bar_len + "░" * (30 - bar_len)
        lines.append(f"│  {label:<30} [{bar}] {value:.1f}")
    lines.append("└──────────────────────────────────────────────────────────────────────┘")
    lines.append("")

    # Runtime Panel
    lines.append("┌─ RUNTIME ─────────────────────────────────────────────────────────────┐")
    lines.append(f"│  CPU:              {runtime.get('cpu_percent', 0):.1f}%")
    lines.append(f"│  Memory:           {runtime.get('memory_percent', 0):.1f}%")
    lines.append(f"│  WebSocket Count:  {runtime.get('websocket_count', 0)}")
    lines.append(f"│  Queue Depth:      {runtime.get('queue_depth', 0)}")
    lines.append(f"│  EventLoop Block:  {runtime.get('eventloop_latency_ms', 0):.0f}ms")
    lines.append(f"│  Stuck Workers:    {runtime.get('stuck_workers', 0)}")
    lines.append("└──────────────────────────────────────────────────────────────────────┘")
    lines.append("")

    # Provider Panel
    if providers:
        lines.append("┌─ PROVIDERS ───────────────────────────────────────────────────────────┐")
        for p in providers:
            status_icon = "🔴" if p.get("is_degraded") or p.get("unhealthy") else "🟢"
            lines.append(
                f"│  {status_icon} {p.get('name', '?'):<20} "
                f"latency={p.get('latency_ms', 0):.0f}ms  "
                f"timeout={p.get('timeout_rate', 0):.0%}  "
                f"error={p.get('failure_rate', p.get('error_rate', 0)):.0%}"
            )
        lines.append("└──────────────────────────────────────────────────────────────────────┘")
        lines.append("")

    # Browser Panel
    lines.append("┌─ BROWSER ─────────────────────────────────────────────────────────────┐")
    lines.append(f"│  Active Sessions:       {browser.get('active_sessions', 0)}")
    lines.append(f"│  Render Instability:    {browser.get('render_instability_score', 0):.2f}")
    lines.append(f"│  Stale State Count:     {browser.get('stale_state_count', 0)}")
    lines.append(f"│  Hydration Errors:      {browser.get('hydration_errors', 0)}")
    lines.append("└──────────────────────────────────────────────────────────────────────┘")
    lines.append("")

    # Collapse Scenario
    if failure_chain:
        lines.append("┌─ COLLAPSE SCENARIO / FAILURE CHAIN ──────────────────────────────────┐")
        for i, step in enumerate(failure_chain, 1):
            lines.append(f"│  {i:02d}. {step}")
        lines.append("└──────────────────────────────────────────────────────────────────────┘")
        lines.append("")

    # Blast Radius
    if blast_radius:
        lines.append("┌─ BLAST RADIUS ────────────────────────────────────────────────────────┐")
        for key, value in blast_radius.items():
            lines.append(f"│  {key}: {value}")
        lines.append("└──────────────────────────────────────────────────────────────────────┘")
        lines.append("")

    # Recovery Analysis
    if recovery_analysis:
        lines.append("┌─ RECOVERY ANALYSIS ───────────────────────────────────────────────────┐")
        for key, value in recovery_analysis.items():
            lines.append(f"│  {key}: {value}")
        lines.append("└──────────────────────────────────────────────────────────────────────┘")
        lines.append("")

    # Active Alerts
    if alerts:
        lines.append("┌─ ACTIVE ALERTS ───────────────────────────────────────────────────────┐")
        for alert in alerts[:10]:
            level = alert.get("level", "?")
            msg = alert.get("message", "?")
            src = alert.get("source", "?")
            lines.append(f"│  [{level}] {msg} (source: {src})")
        if len(alerts) > 10:
            lines.append(f"│  ... and {len(alerts) - 10} more alerts")
        lines.append("└──────────────────────────────────────────────────────────────────────┘")
        lines.append("")

    # Architecture Weakness
    if architecture_weakness:
        lines.append("┌─ ARCHITECTURE WEAKNESS ───────────────────────────────────────────────┐")
        for weakness in architecture_weakness:
            lines.append(f"│  ⚠ {weakness}")
        lines.append("└──────────────────────────────────────────────────────────────────────┘")
        lines.append("")

    # Recommendations
    if recommendations:
        lines.append("┌─ RECOMMENDED ACTIONS ─────────────────────────────────────────────────┐")
        for i, rec in enumerate(recommendations, 1):
            lines.append(f"│  {i}. {rec}")
        lines.append("└──────────────────────────────────────────────────────────────────────┘")
        lines.append("")

    # Production Readiness
    lines.append("┌─ PRODUCTION READINESS ────────────────────────────────────────────────┐")
    if survival >= 80 and risk < 20:
        lines.append("│  ✅ PRODUCTION READY — System operational within acceptable parameters")
    elif survival >= 60:
        lines.append("│  ⚠️  CONDITIONAL — System degraded, monitor closely before deployment")
    elif survival >= 40:
        lines.append("│  🔶 AT RISK — Significant operational concerns, deployment not advised")
    else:
        lines.append("│  🔴 NOT READY — System in critical state, immediate intervention required")
    lines.append("└──────────────────────────────────────────────────────────────────────┘")
    lines.append("")
    lines.append("═" * 72)
    lines.append("  END OF BRIEFING")
    lines.append("═" * 72)

    return "\n".join(lines)
