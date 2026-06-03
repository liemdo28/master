"""Monorepo structure detection and workspace analysis."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class MonorepoInfo:
    is_monorepo: bool = False
    workspace_tool: str | None = None  # pnpm | yarn | npm | turborepo | nx | lerna
    workspace_patterns: list[str] = field(default_factory=list)
    packages: list[str] = field(default_factory=list)
    shared_configs: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "is_monorepo": self.is_monorepo,
            "workspace_tool": self.workspace_tool,
            "workspace_patterns": self.workspace_patterns,
            "packages": self.packages,
            "shared_configs": self.shared_configs,
        }


class MonorepoDetector:
    """Detect monorepo patterns and workspace configurations."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path).expanduser().resolve()

    def detect(self) -> MonorepoInfo:
        info = MonorepoInfo()

        # Check pnpm workspaces
        pnpm_workspace = self.path / "pnpm-workspace.yaml"
        if pnpm_workspace.exists():
            info.is_monorepo = True
            info.workspace_tool = "pnpm"
            try:
                text = pnpm_workspace.read_text(encoding="utf-8")
                for line in text.splitlines():
                    line = line.strip().lstrip("- ").strip("'\"")
                    if line and not line.startswith("#") and not line.startswith("packages"):
                        info.workspace_patterns.append(line)
            except OSError:
                pass

        # Check package.json workspaces
        pkg_json = self.path / "package.json"
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text(encoding="utf-8"))
                workspaces = data.get("workspaces", [])
                if isinstance(workspaces, dict):
                    workspaces = workspaces.get("packages", [])
                if workspaces:
                    info.is_monorepo = True
                    info.workspace_patterns = workspaces
                    if not info.workspace_tool:
                        if (self.path / "yarn.lock").exists():
                            info.workspace_tool = "yarn"
                        elif (self.path / "package-lock.json").exists():
                            info.workspace_tool = "npm"
            except (json.JSONDecodeError, OSError):
                pass

        # Check for Turborepo
        if (self.path / "turbo.json").exists():
            info.is_monorepo = True
            info.workspace_tool = "turborepo"

        # Check for Nx
        if (self.path / "nx.json").exists():
            info.is_monorepo = True
            info.workspace_tool = "nx"

        # Check for Lerna
        if (self.path / "lerna.json").exists():
            info.is_monorepo = True
            info.workspace_tool = "lerna"

        # Discover actual packages
        if info.is_monorepo:
            info.packages = self._discover_packages()
            info.shared_configs = self._find_shared_configs()

        # Heuristic: multiple project dirs without explicit workspace config
        if not info.is_monorepo:
            project_dirs = ["packages", "apps", "services", "libs"]
            for d in project_dirs:
                container = self.path / d
                if container.is_dir():
                    children = [c.name for c in container.iterdir() if c.is_dir() and not c.name.startswith(".")]
                    if len(children) >= 2:
                        info.is_monorepo = True
                        info.workspace_tool = "implicit"
                        info.packages = children
                        break

        return info

    def _discover_packages(self) -> list[str]:
        """Find all package directories in the monorepo."""
        packages: list[str] = []
        search_dirs = ["packages", "apps", "services", "libs", "modules"]
        for d in search_dirs:
            container = self.path / d
            if container.is_dir():
                for child in sorted(container.iterdir()):
                    if child.is_dir() and not child.name.startswith("."):
                        packages.append(f"{d}/{child.name}")
        return packages

    def _find_shared_configs(self) -> list[str]:
        """Find shared configuration files at monorepo root."""
        shared: list[str] = []
        config_patterns = [
            "tsconfig.json", "tsconfig.base.json",
            ".eslintrc*", "eslint.config.*",
            ".prettierrc*", "prettier.config.*",
            "jest.config.*", "vitest.config.*",
            "tailwind.config.*",
        ]
        for pattern in config_patterns:
            matches = list(self.path.glob(pattern))
            for m in matches:
                shared.append(m.name)
        return shared
