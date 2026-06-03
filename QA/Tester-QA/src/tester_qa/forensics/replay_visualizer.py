"""Replay Visualizer - Visualize timelines and failure diagrams."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass
class TimelineEvent:
    timestamp: datetime
    event_name: str
    component: str
    event_type: str
    severity: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class FailureNode:
    node_id: str
    label: str
    x: float
    y: float
    severity: float


@dataclass
class FailureEdge:
    source_id: str
    target_id: str
    delay_ms: float


@dataclass
class TimelineVisualization:
    title: str
    events: list[TimelineEvent]
    time_range_ms: float
    lanes: list[str]
    svg_content: str


@dataclass
class FailureDiagram:
    title: str
    nodes: list[FailureNode]
    edges: list[FailureEdge]
    svg_content: str


class ReplayVisualizer:
    """Generate timeline visualizations and failure diagrams."""

    def __init__(self):
        self.visualizations: list[TimelineVisualization] = []
        self.diagrams: list[FailureDiagram] = []

    def generate_timeline_visualization(
        self,
        events: list[TimelineEvent],
        title: str = "Execution Timeline",
        lanes: Optional[list[str]] = None,
    ) -> TimelineVisualization:
        """Generate a timeline visualization from events."""
        if not events:
            time_range_ms = 0.0
        else:
            start = min(e.timestamp for e in events)
            end = max(e.timestamp for e in events)
            time_range_ms = (end - start).total_seconds() * 1000

        if lanes is None:
            lanes = sorted(set(e.component for e in events))

        svg = self._render_timeline_svg(events, title, time_range_ms, lanes)

        viz = TimelineVisualization(
            title=title,
            events=events,
            time_range_ms=time_range_ms,
            lanes=lanes,
            svg_content=svg,
        )
        self.visualizations.append(viz)
        return viz

    def _render_timeline_svg(
        self,
        events: list[TimelineEvent],
        title: str,
        time_range_ms: float,
        lanes: list[str],
    ) -> str:
        """Render timeline as SVG."""
        width = 800
        height = 100 + len(lanes) * 40
        lane_height = 40
        header_height = 50

        lines: list[str] = []
        lines.append(f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">')
        lines.append(f'  <rect width="{width}" height="{height}" fill="#f8f9fa"/>')
        lines.append(f'  <text x="10" y="30" font-size="16" font-weight="bold">{title}</text>')

        for i, lane in enumerate(lanes):
            y = header_height + i * lane_height
            lines.append(f'  <line x1="0" y1="{y}" x2="{width}" y2="{y}" stroke="#dee2e6" stroke-width="1"/>')
            lines.append(f'  <text x="5" y="{y + 25}" font-size="10">{lane}</text>')

            lane_events = [e for e in events if e.component == lane]
            for evt in lane_events:
                if time_range_ms > 0:
                    x_ratio = (
                        (evt.timestamp - events[0].timestamp).total_seconds() * 1000 / time_range_ms
                    )
                else:
                    x_ratio = 0.0
                x = 100 + x_ratio * (width - 120)
                color = "#dc3545" if evt.severity > 5 else "#ffc107" if evt.severity > 2 else "#28a745"
                lines.append(
                    f'  <circle cx="{x:.1f}" cy="{y + 20}" r="5" fill="{color}" '
                    f'title="{evt.event_name}"/>'
                )

        lines.append("</svg>")
        return "\n".join(lines)

    def create_failure_diagram(
        self,
        nodes: list[FailureNode],
        edges: list[FailureEdge],
        title: str = "Failure Chain",
    ) -> FailureDiagram:
        """Create a failure chain diagram."""
        svg = self._render_failure_svg(nodes, edges, title)

        diagram = FailureDiagram(
            title=title,
            nodes=nodes,
            edges=edges,
            svg_content=svg,
        )
        self.diagrams.append(diagram)
        return diagram

    def _render_failure_svg(
        self,
        nodes: list[FailureNode],
        edges: list[FailureEdge],
        title: str,
    ) -> str:
        """Render failure diagram as SVG."""
        width = 600
        height = 400

        lines: list[str] = []
        lines.append(f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">')
        lines.append(f'  <rect width="{width}" height="{height}" fill="#fff"/>')
        lines.append(f'  <text x="10" y="30" font-size="16" font-weight="bold">{title}</text>')

        for edge in edges:
            src = next((n for n in nodes if n.node_id == edge.source_id), None)
            tgt = next((n for n in nodes if n.node_id == edge.target_id), None)
            if src and tgt:
                lines.append(
                    f'  <line x1="{src.x}" y1="{src.y}" x2="{tgt.x}" y2="{tgt.y}" '
                    f'stroke="#6c757d" stroke-width="1"/>'
                )

        for node in nodes:
            color = "#dc3545" if node.severity > 5 else "#ffc107" if node.severity > 2 else "#28a745"
            lines.append(
                f'  <circle cx="{node.x}" cy="{node.y}" r="15" fill="{color}"/>'
                f'<text x="{node.x - 10}" y="{node.y + 30}" font-size="9">{node.label}</text>'
            )

        lines.append("</svg>")
        return "\n".join(lines)

    def export_replay(
        self,
        format: str = "svg",
        include_timelines: bool = True,
        include_diagrams: bool = True,
    ) -> dict[str, str]:
        """Export replay data in specified format."""
        export: dict[str, str] = {}

        if include_timelines:
            for i, viz in enumerate(self.visualizations):
                key = f"timeline_{i}_{viz.title.replace(' ', '_')}"
                if format == "svg":
                    export[key] = viz.svg_content
                else:
                    export[key] = viz.svg_content

        if include_diagrams:
            for i, diag in enumerate(self.diagrams):
                key = f"diagram_{i}_{diag.title.replace(' ', '_')}"
                if format == "svg":
                    export[key] = diag.svg_content
                else:
                    export[key] = diag.svg_content

        return export
