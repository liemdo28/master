"""Evidence Bundle Engine — Auto-collect everything on failure.

Every major failure automatically creates an Evidence Bundle containing:
- Screenshots, videos, websocket logs, console logs
- Runtime metrics, failure timeline, architecture snapshot
"""
from __future__ import annotations

import json
import logging
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from tester_qa.models import EvidenceType, Severity

LOGGER = logging.getLogger(__name__)


@dataclass
class EvidenceItem:
    """A single piece of evidence within a bundle."""
    item_type: str
    path: str
    description: str
    captured_at: str
    size_bytes: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "item_type": self.item_type,
            "path": self.path,
            "description": self.description,
            "captured_at": self.captured_at,
            "size_bytes": self.size_bytes,
            "metadata": self.metadata,
        }


@dataclass
class EvidenceBundle:
    """Complete evidence bundle for an incident or failure."""
    bundle_id: str
    incident_id: Optional[str]
    title: str
    severity: str
    created_at: str
    bundle_path: str
    items: list[EvidenceItem] = field(default_factory=list)
    timeline: list[dict[str, Any]] = field(default_factory=list)
    runtime_snapshot: dict[str, Any] = field(default_factory=dict)
    architecture_snapshot: dict[str, Any] = field(default_factory=dict)
    failure_chain: list[str] = field(default_factory=list)
    blast_radius: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "bundle_id": self.bundle_id,
            "incident_id": self.incident_id,
            "title": self.title,
            "severity": self.severity,
            "created_at": self.created_at,
            "bundle_path": self.bundle_path,
            "item_count": len(self.items),
            "items": [item.to_dict() for item in self.items],
            "timeline": self.timeline,
            "runtime_snapshot": self.runtime_snapshot,
            "architecture_snapshot": self.architecture_snapshot,
            "failure_chain": self.failure_chain,
            "blast_radius": self.blast_radius,
        }

    def to_manifest(self) -> str:
        """Generate a manifest file for the bundle."""
        lines = [
            f"# Evidence Bundle: {self.bundle_id}",
            f"## Incident: {self.incident_id or 'N/A'}",
            f"## Title: {self.title}",
            f"## Severity: {self.severity}",
            f"## Created: {self.created_at}",
            "",
            "## Items",
        ]
        for item in self.items:
            lines.append(f"- [{item.item_type}] {item.description} → {item.path}")
        if self.timeline:
            lines.append("")
            lines.append("## Timeline")
            for event in self.timeline:
                lines.append(f"- {event.get('timestamp', '?')} | {event.get('event', '?')}")
        if self.failure_chain:
            lines.append("")
            lines.append("## Failure Chain")
            for step in self.failure_chain:
                lines.append(f"  → {step}")
        return "\n".join(lines)


class EvidenceBundleEngine:
    """Automatically creates evidence bundles on failure events."""

    def __init__(self, evidence_root: Path | str = "evidence") -> None:
        self.evidence_root = Path(evidence_root)
        self._bundles: list[EvidenceBundle] = []
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for subdir in ["bundles", "screenshots", "console", "network",
                       "websocket", "heapdump", "runtime", "timelines", "incidents"]:
            (self.evidence_root / subdir).mkdir(parents=True, exist_ok=True)

    def create_bundle(
        self,
        title: str,
        severity: str = "high",
        incident_id: Optional[str] = None,
    ) -> EvidenceBundle:
        """Create a new evidence bundle directory and manifest."""
        bundle_id = f"BDL-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}-{uuid4().hex[:8]}"
        bundle_dir = self.evidence_root / "bundles" / bundle_id
        bundle_dir.mkdir(parents=True, exist_ok=True)

        bundle = EvidenceBundle(
            bundle_id=bundle_id,
            incident_id=incident_id,
            title=title,
            severity=severity,
            created_at=datetime.now(timezone.utc).isoformat(),
            bundle_path=str(bundle_dir),
        )
        self._bundles.append(bundle)
        return bundle

    def add_screenshot(
        self,
        bundle: EvidenceBundle,
        source_path: Optional[Path] = None,
        description: str = "Screenshot capture",
    ) -> EvidenceItem:
        """Add screenshot evidence to bundle."""
        bundle_dir = Path(bundle.bundle_path)
        if source_path and source_path.exists():
            dest = bundle_dir / f"screenshot-{uuid4().hex[:6]}{source_path.suffix}"
            shutil.copy2(source_path, dest)
        else:
            dest = bundle_dir / f"screenshot-{uuid4().hex[:6]}.svg"
            svg = (
                '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">'
                '<rect width="100%" height="100%" fill="#111827"/>'
                '<text x="48" y="96" fill="#f9fafb" font-family="monospace" font-size="24">'
                f'Evidence: {description}</text></svg>'
            )
            dest.write_text(svg, encoding="utf-8")

        item = EvidenceItem(
            item_type="screenshot",
            path=str(dest),
            description=description,
            captured_at=datetime.now(timezone.utc).isoformat(),
            size_bytes=dest.stat().st_size if dest.exists() else 0,
        )
        bundle.items.append(item)
        return item

    def add_console_log(
        self,
        bundle: EvidenceBundle,
        content: str,
        description: str = "Console output",
    ) -> EvidenceItem:
        """Add console log evidence to bundle."""
        bundle_dir = Path(bundle.bundle_path)
        dest = bundle_dir / f"console-{uuid4().hex[:6]}.log"
        dest.write_text(content, encoding="utf-8")

        item = EvidenceItem(
            item_type="console",
            path=str(dest),
            description=description,
            captured_at=datetime.now(timezone.utc).isoformat(),
            size_bytes=len(content.encode("utf-8")),
        )
        bundle.items.append(item)
        return item

    def add_network_trace(
        self,
        bundle: EvidenceBundle,
        requests: list[dict[str, Any]],
        description: str = "Network trace",
    ) -> EvidenceItem:
        """Add network/HAR trace to bundle."""
        bundle_dir = Path(bundle.bundle_path)
        dest = bundle_dir / f"network-{uuid4().hex[:6]}.json"
        dest.write_text(json.dumps(requests, indent=2, ensure_ascii=False), encoding="utf-8")

        item = EvidenceItem(
            item_type="network",
            path=str(dest),
            description=description,
            captured_at=datetime.now(timezone.utc).isoformat(),
            size_bytes=dest.stat().st_size,
            metadata={"request_count": len(requests)},
        )
        bundle.items.append(item)
        return item

    def add_websocket_trace(
        self,
        bundle: EvidenceBundle,
        messages: list[dict[str, Any]],
        description: str = "WebSocket trace",
    ) -> EvidenceItem:
        """Add websocket message trace to bundle."""
        bundle_dir = Path(bundle.bundle_path)
        dest = bundle_dir / f"websocket-{uuid4().hex[:6]}.json"
        dest.write_text(json.dumps(messages, indent=2, ensure_ascii=False), encoding="utf-8")

        item = EvidenceItem(
            item_type="websocket",
            path=str(dest),
            description=description,
            captured_at=datetime.now(timezone.utc).isoformat(),
            size_bytes=dest.stat().st_size,
            metadata={"message_count": len(messages)},
        )
        bundle.items.append(item)
        return item

    def add_runtime_metrics(
        self,
        bundle: EvidenceBundle,
        metrics: dict[str, Any],
        description: str = "Runtime metrics snapshot",
    ) -> EvidenceItem:
        """Add runtime metrics snapshot to bundle."""
        bundle_dir = Path(bundle.bundle_path)
        dest = bundle_dir / f"runtime-{uuid4().hex[:6]}.json"
        dest.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
        bundle.runtime_snapshot = metrics

        item = EvidenceItem(
            item_type="runtime",
            path=str(dest),
            description=description,
            captured_at=datetime.now(timezone.utc).isoformat(),
            size_bytes=dest.stat().st_size,
        )
        bundle.items.append(item)
        return item

    def add_timeline(
        self,
        bundle: EvidenceBundle,
        events: list[dict[str, Any]],
        description: str = "Failure timeline",
    ) -> EvidenceItem:
        """Add failure timeline to bundle."""
        bundle_dir = Path(bundle.bundle_path)
        dest = bundle_dir / f"timeline-{uuid4().hex[:6]}.json"
        dest.write_text(json.dumps(events, indent=2, ensure_ascii=False), encoding="utf-8")
        bundle.timeline = events

        item = EvidenceItem(
            item_type="timeline",
            path=str(dest),
            description=description,
            captured_at=datetime.now(timezone.utc).isoformat(),
            size_bytes=dest.stat().st_size,
            metadata={"event_count": len(events)},
        )
        bundle.items.append(item)
        return item

    def add_heapdump(
        self,
        bundle: EvidenceBundle,
        heap_data: dict[str, Any],
        description: str = "Heap dump snapshot",
    ) -> EvidenceItem:
        """Add heap dump to bundle."""
        bundle_dir = Path(bundle.bundle_path)
        dest = bundle_dir / f"heapdump-{uuid4().hex[:6]}.json"
        dest.write_text(json.dumps(heap_data, indent=2, ensure_ascii=False), encoding="utf-8")

        item = EvidenceItem(
            item_type="heapdump",
            path=str(dest),
            description=description,
            captured_at=datetime.now(timezone.utc).isoformat(),
            size_bytes=dest.stat().st_size,
        )
        bundle.items.append(item)
        return item

    def set_failure_chain(self, bundle: EvidenceBundle, chain: list[str]) -> None:
        """Set the failure propagation chain."""
        bundle.failure_chain = chain

    def set_blast_radius(self, bundle: EvidenceBundle, blast_radius: dict[str, Any]) -> None:
        """Set the blast radius analysis."""
        bundle.blast_radius = blast_radius

    def finalize_bundle(self, bundle: EvidenceBundle) -> Path:
        """Finalize bundle and write manifest."""
        bundle_dir = Path(bundle.bundle_path)
        manifest_path = bundle_dir / "MANIFEST.md"
        manifest_path.write_text(bundle.to_manifest(), encoding="utf-8")

        index_path = bundle_dir / "index.json"
        index_path.write_text(
            json.dumps(bundle.to_dict(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        LOGGER.info(f"Evidence bundle finalized: {bundle.bundle_id} ({len(bundle.items)} items)")
        return manifest_path

    def get_bundles(self) -> list[EvidenceBundle]:
        return list(self._bundles)

    def get_bundle(self, bundle_id: str) -> Optional[EvidenceBundle]:
        for b in self._bundles:
            if b.bundle_id == bundle_id:
                return b
        return None

    def create_failure_bundle(
        self,
        title: str,
        severity: str,
        incident_id: Optional[str] = None,
        console_output: str = "",
        runtime_metrics: Optional[dict[str, Any]] = None,
        timeline_events: Optional[list[dict[str, Any]]] = None,
        failure_chain: Optional[list[str]] = None,
        blast_radius: Optional[dict[str, Any]] = None,
    ) -> EvidenceBundle:
        """One-shot: create a complete failure evidence bundle."""
        bundle = self.create_bundle(title, severity, incident_id)

        self.add_screenshot(bundle, description=f"Failure state: {title}")

        if console_output:
            self.add_console_log(bundle, console_output, "Failure console output")

        if runtime_metrics:
            self.add_runtime_metrics(bundle, runtime_metrics)

        if timeline_events:
            self.add_timeline(bundle, timeline_events)

        if failure_chain:
            self.set_failure_chain(bundle, failure_chain)

        if blast_radius:
            self.set_blast_radius(bundle, blast_radius)

        self.finalize_bundle(bundle)
        return bundle
