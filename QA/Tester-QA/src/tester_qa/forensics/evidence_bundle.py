"""Evidence Bundle Generator — Auto-collects all failure evidence into bundles."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4


@dataclass
class EvidenceItem:
    """A single piece of evidence within a bundle."""
    category: str  # screenshot, video, console, network, websocket, heapdump, runtime, timeline
    path: Optional[str] = None
    content: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "category": self.category,
            "path": self.path,
            "content": self.content[:200] if self.content else None,
            "metadata": self.metadata,
            "timestamp": self.timestamp,
        }


@dataclass
class EvidenceBundle:
    """
    A complete evidence bundle for a failure event.
    Contains all collected artifacts: screenshots, videos, logs, traces, metrics.
    """
    bundle_id: str
    incident_id: Optional[str] = None
    title: str = ""
    created_at: float = field(default_factory=time.time)
    items: list[EvidenceItem] = field(default_factory=list)
    failure_timeline: list[dict[str, Any]] = field(default_factory=list)
    architecture_snapshot: dict[str, Any] = field(default_factory=dict)
    runtime_metrics: dict[str, Any] = field(default_factory=dict)
    executive_summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "bundle_id": self.bundle_id,
            "incident_id": self.incident_id,
            "title": self.title,
            "created_at": self.created_at,
            "item_count": len(self.items),
            "categories": list(set(i.category for i in self.items)),
            "failure_timeline": self.failure_timeline,
            "architecture_snapshot": self.architecture_snapshot,
            "runtime_metrics": self.runtime_metrics,
            "executive_summary": self.executive_summary,
        }

    def add_item(self, category: str, path: Optional[str] = None, content: Optional[str] = None, **metadata: Any) -> None:
        self.items.append(EvidenceItem(
            category=category,
            path=path,
            content=content,
            metadata=metadata,
        ))


class EvidenceBundleGenerator:
    """
    Automatically generates evidence bundles for failure events.
    Collects screenshots, console logs, websocket traces, runtime metrics,
    failure timelines, and architecture snapshots into a single bundle.
    """

    def __init__(self, evidence_root: Path) -> None:
        self._root = evidence_root
        self._bundles: list[EvidenceBundle] = []

    def create_bundle(
        self,
        title: str,
        incident_id: Optional[str] = None,
    ) -> EvidenceBundle:
        """Create a new empty evidence bundle."""
        bundle_id = f"BUNDLE-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid4().hex[:8]}"
        bundle = EvidenceBundle(
            bundle_id=bundle_id,
            incident_id=incident_id,
            title=title,
        )
        self._bundles.append(bundle)
        return bundle

    def auto_collect(
        self,
        bundle: EvidenceBundle,
        include_screenshots: bool = True,
        include_console: bool = True,
        include_network: bool = True,
        include_websocket: bool = True,
        include_runtime: bool = True,
        include_heapdump: bool = False,
    ) -> EvidenceBundle:
        """
        Auto-collect available evidence from the evidence directory structure.
        """
        if include_screenshots:
            self._collect_from_dir(bundle, "screenshots", "screenshot")
        if include_console:
            self._collect_from_dir(bundle, "console", "console")
        if include_network:
            self._collect_from_dir(bundle, "network", "network")
        if include_websocket:
            self._collect_from_dir(bundle, "websocket", "websocket")
        if include_runtime:
            self._collect_from_dir(bundle, "metrics", "runtime")
        if include_heapdump:
            self._collect_from_dir(bundle, "heapdump", "heapdump")

        # Collect timelines
        timelines_dir = self._root / "timelines"
        if timelines_dir.exists():
            for f in sorted(timelines_dir.iterdir())[-5:]:
                if f.suffix == ".json":
                    try:
                        data = json.loads(f.read_text(encoding="utf-8"))
                        if isinstance(data, list):
                            bundle.failure_timeline.extend(data)
                        elif isinstance(data, dict):
                            bundle.failure_timeline.append(data)
                    except (json.JSONDecodeError, OSError):
                        pass

        return bundle

    def generate_full_bundle(
        self,
        title: str,
        incident_id: Optional[str] = None,
        runtime_metrics: Optional[dict[str, Any]] = None,
        architecture_snapshot: Optional[dict[str, Any]] = None,
    ) -> EvidenceBundle:
        """
        Generate a complete evidence bundle with all available data.
        This is the primary method called during failure events.
        """
        bundle = self.create_bundle(title, incident_id)
        self.auto_collect(bundle)

        if runtime_metrics:
            bundle.runtime_metrics = runtime_metrics
        if architecture_snapshot:
            bundle.architecture_snapshot = architecture_snapshot

        bundle.executive_summary = self._generate_summary(bundle)
        self._persist_bundle(bundle)
        return bundle

    def get_bundles(self, limit: int = 50) -> list[EvidenceBundle]:
        return self._bundles[-limit:]

    def get_bundle(self, bundle_id: str) -> Optional[EvidenceBundle]:
        for b in self._bundles:
            if b.bundle_id == bundle_id:
                return b
        return None

    def _collect_from_dir(self, bundle: EvidenceBundle, subdir: str, category: str) -> None:
        """Collect recent files from a subdirectory."""
        target = self._root / subdir
        if not target.exists():
            return
        files = sorted(target.iterdir(), key=lambda f: f.stat().st_mtime if f.is_file() else 0)
        for f in files[-10:]:  # Last 10 files
            if f.is_file() and f.name != ".gitkeep":
                bundle.add_item(
                    category=category,
                    path=str(f),
                    size_bytes=f.stat().st_size,
                    filename=f.name,
                )

    def _generate_summary(self, bundle: EvidenceBundle) -> str:
        """Generate executive summary for the bundle."""
        categories = set(i.category for i in bundle.items)
        lines = [
            f"Evidence Bundle: {bundle.title}",
            f"Bundle ID: {bundle.bundle_id}",
            f"Incident: {bundle.incident_id or 'N/A'}",
            f"Items Collected: {len(bundle.items)}",
            f"Categories: {', '.join(sorted(categories))}",
            f"Timeline Events: {len(bundle.failure_timeline)}",
        ]
        if bundle.runtime_metrics:
            lines.append(f"Runtime Metrics: {len(bundle.runtime_metrics)} signals")
        if bundle.architecture_snapshot:
            lines.append("Architecture Snapshot: captured")
        return "\n".join(lines)

    def _persist_bundle(self, bundle: EvidenceBundle) -> None:
        """Persist bundle metadata to disk."""
        incidents_dir = self._root / "incidents"
        incidents_dir.mkdir(parents=True, exist_ok=True)
        bundle_path = incidents_dir / f"{bundle.bundle_id}.json"
        bundle_path.write_text(
            json.dumps(bundle.to_dict(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
