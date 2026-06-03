"""Deep framework and runtime detection for projects."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class FrameworkProfile:
    name: str
    version: str | None = None
    category: str = "unknown"  # frontend | backend | fullstack | tool | testing
    config_files: list[str] = field(default_factory=list)
    entry_points: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "version": self.version,
            "category": self.category,
            "config_files": self.config_files,
            "entry_points": self.entry_points,
        }


FRAMEWORK_CATEGORIES = {
    "Next.js": "fullstack",
    "React": "frontend",
    "Vue": "frontend",
    "Nuxt": "fullstack",
    "Angular": "frontend",
    "Svelte": "frontend",
    "Vite": "tool",
    "Express": "backend",
    "Fastify": "backend",
    "NestJS": "backend",
    "Koa": "backend",
    "Hono": "backend",
    "FastAPI": "backend",
    "Flask": "backend",
    "Django": "fullstack",
    "Starlette": "backend",
    "Remix": "fullstack",
    "Astro": "frontend",
}


class FrameworkDetector:
    """Deep detection of frameworks with version and config analysis."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path).expanduser().resolve()

    def detect(self) -> list[FrameworkProfile]:
        """Detect all frameworks in the project."""
        profiles: list[FrameworkProfile] = []
        profiles.extend(self._detect_node_frameworks())
        profiles.extend(self._detect_python_frameworks())
        profiles.extend(self._detect_by_config_files())
        # Deduplicate by name
        seen: set[str] = set()
        unique: list[FrameworkProfile] = []
        for p in profiles:
            if p.name not in seen:
                seen.add(p.name)
                unique.append(p)
        return unique

    def _detect_node_frameworks(self) -> list[FrameworkProfile]:
        """Detect Node.js frameworks from package.json."""
        profiles: list[FrameworkProfile] = []
        pkg_json = self.path / "package.json"
        if not pkg_json.exists():
            return profiles

        try:
            data = json.loads(pkg_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return profiles

        deps = data.get("dependencies", {})
        dev_deps = data.get("devDependencies", {})
        all_deps = {**deps, **dev_deps}

        framework_packages = {
            "next": "Next.js",
            "react": "React",
            "vue": "Vue",
            "nuxt": "Nuxt",
            "@angular/core": "Angular",
            "svelte": "Svelte",
            "express": "Express",
            "fastify": "Fastify",
            "@nestjs/core": "NestJS",
            "koa": "Koa",
            "hono": "Hono",
            "vite": "Vite",
            "@remix-run/node": "Remix",
            "astro": "Astro",
        }

        for pkg, name in framework_packages.items():
            if pkg in all_deps:
                version = all_deps[pkg].lstrip("^~>=<")
                category = FRAMEWORK_CATEGORIES.get(name, "unknown")
                config_files = self._find_framework_configs(name)
                entry_points = self._find_entry_points(name)
                profiles.append(FrameworkProfile(
                    name=name,
                    version=version,
                    category=category,
                    config_files=config_files,
                    entry_points=entry_points,
                ))

        return profiles

    def _detect_python_frameworks(self) -> list[FrameworkProfile]:
        """Detect Python frameworks from pyproject.toml or requirements.txt."""
        profiles: list[FrameworkProfile] = []

        # Check pyproject.toml
        pyproject = self.path / "pyproject.toml"
        if pyproject.exists():
            try:
                text = pyproject.read_text(encoding="utf-8")
                py_frameworks = {
                    "fastapi": "FastAPI",
                    "flask": "Flask",
                    "django": "Django",
                    "starlette": "Starlette",
                }
                for dep, name in py_frameworks.items():
                    if dep in text.lower():
                        profiles.append(FrameworkProfile(
                            name=name,
                            category=FRAMEWORK_CATEGORIES.get(name, "backend"),
                            config_files=self._find_framework_configs(name),
                            entry_points=self._find_entry_points(name),
                        ))
            except OSError:
                pass

        # Check requirements.txt
        requirements = self.path / "requirements.txt"
        if requirements.exists():
            try:
                lines = requirements.read_text(encoding="utf-8").splitlines()
                for line in lines:
                    line = line.strip().lower()
                    if line.startswith("fastapi"):
                        profiles.append(FrameworkProfile(name="FastAPI", category="backend"))
                    elif line.startswith("flask"):
                        profiles.append(FrameworkProfile(name="Flask", category="backend"))
                    elif line.startswith("django"):
                        profiles.append(FrameworkProfile(name="Django", category="fullstack"))
            except OSError:
                pass

        return profiles

    def _detect_by_config_files(self) -> list[FrameworkProfile]:
        """Detect frameworks by their config files."""
        profiles: list[FrameworkProfile] = []
        config_map = {
            "next.config.js": "Next.js",
            "next.config.mjs": "Next.js",
            "next.config.ts": "Next.js",
            "nuxt.config.ts": "Nuxt",
            "nuxt.config.js": "Nuxt",
            "vite.config.ts": "Vite",
            "vite.config.js": "Vite",
            "svelte.config.js": "Svelte",
            "angular.json": "Angular",
            "astro.config.mjs": "Astro",
        }
        for config_file, name in config_map.items():
            if (self.path / config_file).exists():
                profiles.append(FrameworkProfile(
                    name=name,
                    category=FRAMEWORK_CATEGORIES.get(name, "unknown"),
                    config_files=[config_file],
                ))
        return profiles

    def _find_framework_configs(self, framework: str) -> list[str]:
        """Find config files associated with a framework."""
        configs: list[str] = []
        config_patterns: dict[str, list[str]] = {
            "Next.js": ["next.config.*"],
            "Vite": ["vite.config.*"],
            "NestJS": ["nest-cli.json"],
            "Angular": ["angular.json"],
            "Nuxt": ["nuxt.config.*"],
            "Svelte": ["svelte.config.*"],
            "Django": ["manage.py", "settings.py"],
            "FastAPI": ["main.py", "app.py"],
        }
        patterns = config_patterns.get(framework, [])
        for pattern in patterns:
            if "*" in pattern:
                matches = list(self.path.glob(pattern))
                configs.extend(m.name for m in matches)
            else:
                if (self.path / pattern).exists():
                    configs.append(pattern)
        return configs

    def _find_entry_points(self, framework: str) -> list[str]:
        """Find likely entry point files for a framework."""
        entry_map: dict[str, list[str]] = {
            "Next.js": ["app/layout.tsx", "pages/_app.tsx", "src/app/layout.tsx"],
            "React": ["src/index.tsx", "src/main.tsx", "src/App.tsx"],
            "Express": ["src/index.ts", "src/server.ts", "index.js", "server.js"],
            "FastAPI": ["main.py", "app/main.py", "src/main.py"],
            "Django": ["manage.py"],
            "NestJS": ["src/main.ts"],
        }
        candidates = entry_map.get(framework, [])
        found: list[str] = []
        for candidate in candidates:
            if (self.path / candidate).exists():
                found.append(candidate)
        return found
