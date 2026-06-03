"""Central project indexer — orchestrates scanning, detection, and registry persistence."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tester_qa.projects.scanner import MultiProjectScanner, ProjectInfo
from tester_qa.projects.monorepo_detector import MonorepoDetector
from tester_qa.projects.framework_detector import FrameworkDetector
from tester_qa.projects.runtime_locator import RuntimeLocator


CONFIG_PATH = Path("config/projects.json")


class ProjectIndexer:
    """Orchestrates full project discovery and indexing."""

    def __init__(self, config_path: Path | str = CONFIG_PATH) -> None:
        self.config_path = Path(config_path)

    def index_path(self, path: Path | str) -> list[dict[str, Any]]:
        """Scan a path and return fully indexed project data."""
        root = Path(path).expanduser().resolve()

        # Phase 1: Discover projects
        scanner = MultiProjectScanner(root)
        projects = scanner.scan()

        # Phase 2: Deep analysis per project
        indexed: list[dict[str, Any]] = []
        for project in projects:
            project_path = Path(project.path)

            # Monorepo detection
            mono = MonorepoDetector(project_path).detect()
            mono_dict = mono.to_dict() if mono.is_monorepo else None

            # Framework detection
            frameworks = FrameworkDetector(project_path).detect()
            framework_dicts = [f.to_dict() for f in frameworks]

            # Runtime detection
            runtimes = RuntimeLocator(project_path).locate()
            runtime_dicts = [r.to_dict() for r in runtimes]

            entry = {
                **project.to_dict(),
                "monorepo_info": mono_dict,
                "detected_frameworks": framework_dicts,
                "runtimes": runtime_dicts,
                "indexed_at": datetime.now(timezone.utc).isoformat(),
            }
            indexed.append(entry)

        return indexed

    def index_and_save(self, path: Path | str) -> list[dict[str, Any]]:
        """Scan, index, and persist to config/projects.json."""
        indexed = self.index_path(path)
        self._save_config(indexed)
        return indexed

    def register_project(
        self,
        project_id: str,
        path: str,
        enabled: bool = True,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Manually register a project."""
        config = self._load_config()
        entry = {
            "id": project_id,
            "path": path,
            "enabled": enabled,
            "tags": tags or [],
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }

        # Update or append
        existing_ids = {p.get("id") or p.get("name") for p in config.get("projects", [])}
        if project_id in existing_ids:
            config["projects"] = [
                entry if (p.get("id") or p.get("name")) == project_id else p
                for p in config["projects"]
            ]
        else:
            config.setdefault("projects", []).append(entry)

        self._save_raw_config(config)
        return entry

    def list_projects(self) -> list[dict[str, Any]]:
        """List all registered/indexed projects."""
        config = self._load_config()
        return config.get("projects", [])

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        """Get a specific project by ID or name."""
        for project in self.list_projects():
            if project.get("id") == project_id or project.get("name") == project_id:
                return project
        return None

    def remove_project(self, project_id: str) -> bool:
        """Remove a project from the registry."""
        config = self._load_config()
        original_len = len(config.get("projects", []))
        config["projects"] = [
            p for p in config.get("projects", [])
            if (p.get("id") or p.get("name")) != project_id
        ]
        if len(config["projects"]) < original_len:
            self._save_raw_config(config)
            return True
        return False

    def _save_config(self, indexed: list[dict[str, Any]]) -> None:
        """Save indexed projects to config file."""
        config = {
            "version": "2.0",
            "indexed_at": datetime.now(timezone.utc).isoformat(),
            "projects": indexed,
        }
        self._save_raw_config(config)

    def _save_raw_config(self, config: dict[str, Any]) -> None:
        """Write config dict to disk."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(
            json.dumps(config, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    def _load_config(self) -> dict[str, Any]:
        """Load existing config or return empty structure."""
        if not self.config_path.exists():
            return {"version": "2.0", "projects": []}
        try:
            return json.loads(self.config_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {"version": "2.0", "projects": []}
