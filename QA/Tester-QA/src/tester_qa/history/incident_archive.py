"""Incident archive stored as JSON files."""
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import json
import re
import uuid


class IncidentArchive:
    """Persists incidents to data/archive/incidents/."""

    def __init__(self, root="data/archive/incidents"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def archive(self, incident: dict) -> str:
        """Save incident as JSON file and return archive_id."""
        archive_id = incident.get("archive_id") or f"inc-{uuid.uuid4().hex[:12]}"
        record = {"archive_id": archive_id, "archived_at": datetime.now(timezone.utc).isoformat(), **incident}
        with (self.root / f"{archive_id}.json").open("w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, default=str)
        return archive_id

    def _read_all(self) -> list[dict]:
        out = []
        for path in self.root.glob("*.json"):
            try:
                out.append(json.loads(path.read_text(encoding="utf-8")))
            except (json.JSONDecodeError, OSError):
                continue
        return out

    def search(self, query: str) -> list[dict]:
        """Simple text search in title/summary."""
        q = query.lower()
        results = []
        for inc in self._read_all():
            hay = f"{inc.get('title','')} {inc.get('summary','')}".lower()
            if q in hay:
                results.append(inc)
        return results

    def get_recurring_patterns(self) -> list[dict]:
        """Group incidents by normalized similar titles."""
        counter = Counter()
        examples = {}
        for inc in self._read_all():
            title = inc.get("title", "untitled")
            norm = re.sub(r"\b\d+\b", "#", title.lower())
            norm = re.sub(r"[^a-z0-9# ]+", "", norm)
            norm = re.sub(r"\s+", " ", norm).strip()
            counter[norm] += 1
            examples.setdefault(norm, title)
        return [
            {"pattern": k, "count": v, "example_title": examples.get(k)}
            for k, v in counter.most_common()
            if v > 1
        ]

    def export_corpus(self) -> dict:
        """Return full archive export."""
        incidents = self._read_all()
        return {"count": len(incidents), "exported_at": datetime.now(timezone.utc).isoformat(), "incidents": incidents}
