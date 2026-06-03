"""Multi-project recursive scanner with framework/infra detection."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

IGNORE_DIRS = {
    "node_modules", "dist", "build", ".next", "__pycache__",
    "cache", "venv", ".venv", "tmp", ".git", ".tox", "egg-info",
    ".mypy_cache", ".pytest_cache", "coverage", ".turbo",
    "target", ".cargo", ".gradle",
}


@dataclass
class ProjectInfo:
    name: str
    path: str
    type: str = "standalone"  # standalone | monorepo | workspace-child
    frontend: bool = False
    backend: bool = False
    docker: bool = False
    test_frameworks: list[str] = field(default_factory=list)
    package_manager: str | None = None
    frameworks: list[str] = field(default_factory=list)
    infra: list[str] = field(default_factory=list)
    services: list[str] = field(default_factory=list)
    risk_level: str = "medium"
    children: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "path": self.path,
            "type": self.type,
            "frontend": self.frontend,
            "backend": self.backend,
            "docker": self.docker,
            "test_frameworks": self.test_frameworks,
            "package_manager": self.package_manager,
            "frameworks": self.frameworks,
            "infra": self.infra,
            "services": self.services,
            "risk_level": self.risk_level,
            "children": self.children,
        }


class MultiProjectScanner:
    """Recursively scans a path to discover projects, frameworks, and infrastructure."""

    def __init__(self, root: Path | str) -> None:
        self.root = Path(root).expanduser().resolve()

    def scan(self) -> list[ProjectInfo]:
        """Scan root path and return all discovered projects."""
        if self._is_project(self.root):
            info = self._analyze_project(self.root)
            # Check if monorepo
            children = self._find_child_projects(self.root)
            if children:
                info.type = "monorepo"
                info.children = [str(c) for c in children]
            return [info] + [self._analyze_project(c, parent=self.root) for c in children]
        else:
            # Workspace root — scan all child directories
            projects: list[ProjectInfo] = []
            for child in sorted(self.root.iterdir()):
                if child.is_dir() and child.name not in IGNORE_DIRS and not child.name.startswith("."):
                    if self._is_project(child):
                        info = self._analyze_project(child)
                        sub_children = self._find_child_projects(child)
                        if sub_children:
                            info.type = "monorepo"
                            info.children = [str(c) for c in sub_children]
                            projects.append(info)
                            for sc in sub_children:
                                projects.append(self._analyze_project(sc, parent=child))
                        else:
                            projects.append(info)
            return projects

    def _is_project(self, path: Path) -> bool:
        """Determine if a directory is a project root."""
        markers = [
            "package.json", "pyproject.toml", "Cargo.toml", "go.mod",
            "pom.xml", "build.gradle", "Makefile", "docker-compose.yml",
            "docker-compose.yaml", "Dockerfile", "requirements.txt",
            "setup.py", "setup.cfg",
        ]
        return any((path / m).exists() for m in markers)

    def _find_child_projects(self, root: Path) -> list[Path]:
        """Find nested project directories (monorepo packages, apps, etc.)."""
        children: list[Path] = []
        # Check common monorepo patterns
        mono_dirs = ["packages", "apps", "services", "libs", "modules", "projects"]
        for mono_dir in mono_dirs:
            container = root / mono_dir
            if container.is_dir():
                for child in sorted(container.iterdir()):
                    if child.is_dir() and child.name not in IGNORE_DIRS and self._is_project(child):
                        children.append(child)

        # Also check pnpm/yarn workspaces from package.json
        pkg_json = root / "package.json"
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text(encoding="utf-8"))
                workspaces = data.get("workspaces", [])
                if isinstance(workspaces, dict):
                    workspaces = workspaces.get("packages", [])
                for pattern in workspaces:
                    # Simple glob handling for patterns like "packages/*"
                    if "*" in pattern:
                        base = pattern.replace("/*", "").replace("*", "")
                        container = root / base
                        if container.is_dir():
                            for child in sorted(container.iterdir()):
                                if child.is_dir() and self._is_project(child) and child not in children:
                                    children.append(child)
            except (json.JSONDecodeError, OSError):
                pass

        return children

    def _analyze_project(self, path: Path, parent: Path | None = None) -> ProjectInfo:
        """Analyze a single project directory."""
        info = ProjectInfo(
            name=path.name,
            path=str(path),
            type="workspace-child" if parent else "standalone",
        )

        # Detect package manager
        info.package_manager = self._detect_package_manager(path)

        # Detect frameworks
        info.frameworks = self._detect_frameworks(path)

        # Classify frontend/backend
        frontend_frameworks = {"react", "next.js", "vue", "nuxt", "vite", "svelte", "angular"}
        backend_frameworks = {"express", "fastapi", "flask", "nestjs", "django", "fastify", "koa", "hono"}
        info.frontend = bool(set(f.lower() for f in info.frameworks) & frontend_frameworks)
        info.backend = bool(set(f.lower() for f in info.frameworks) & backend_frameworks)

        # If has both src and pages/app dirs, likely fullstack
        if not info.frontend and not info.backend:
            if (path / "src").is_dir() or (path / "app").is_dir():
                info.frontend = True

        # Detect infra
        info.infra = self._detect_infra(path)
        info.docker = "docker" in info.infra or "docker-compose" in info.infra

        # Detect test frameworks
        info.test_frameworks = self._detect_test_frameworks(path)

        # Detect services
        info.services = self._detect_services(path)

        # Calculate risk
        info.risk_level = self._calculate_risk(info)

        return info

    def _detect_package_manager(self, path: Path) -> str | None:
        if (path / "pnpm-lock.yaml").exists():
            return "pnpm"
        if (path / "yarn.lock").exists():
            return "yarn"
        if (path / "bun.lockb").exists():
            return "bun"
        if (path / "package-lock.json").exists():
            return "npm"
        if (path / "Pipfile.lock").exists():
            return "pipenv"
        if (path / "poetry.lock").exists():
            return "poetry"
        if (path / "uv.lock").exists():
            return "uv"
        if (path / "pyproject.toml").exists():
            return "pip"
        if (path / "Cargo.lock").exists():
            return "cargo"
        if (path / "go.sum").exists():
            return "go"
        return None

    def _detect_frameworks(self, path: Path) -> list[str]:
        frameworks: list[str] = []

        # Node.js detection via package.json
        pkg_json = path / "package.json"
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text(encoding="utf-8"))
                all_deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}

                framework_map = {
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
                    "remix": "Remix",
                    "astro": "Astro",
                }
                for dep, name in framework_map.items():
                    if dep in all_deps:
                        frameworks.append(name)
            except (json.JSONDecodeError, OSError):
                pass

        # Python detection
        pyproject = path / "pyproject.toml"
        if pyproject.exists():
            try:
                text = pyproject.read_text(encoding="utf-8")
                py_frameworks = {
                    "fastapi": "FastAPI",
                    "flask": "Flask",
                    "django": "Django",
                    "starlette": "Starlette",
                    "sanic": "Sanic",
                    "litestar": "Litestar",
                }
                for dep, name in py_frameworks.items():
                    if dep in text.lower():
                        frameworks.append(name)
            except OSError:
                pass

        requirements = path / "requirements.txt"
        if requirements.exists():
            try:
                text = requirements.read_text(encoding="utf-8").lower()
                if "fastapi" in text:
                    frameworks.append("FastAPI")
                if "flask" in text:
                    frameworks.append("Flask")
                if "django" in text:
                    frameworks.append("Django")
            except OSError:
                pass

        return list(dict.fromkeys(frameworks))  # dedupe preserving order

    def _detect_infra(self, path: Path) -> list[str]:
        infra: list[str] = []
        if (path / "Dockerfile").exists() or (path / "dockerfile").exists():
            infra.append("docker")
        if (path / "docker-compose.yml").exists() or (path / "docker-compose.yaml").exists():
            infra.append("docker-compose")
        if (path / "k8s").is_dir() or (path / "kubernetes").is_dir() or (path / "helm").is_dir():
            infra.append("kubernetes")
        if (path / "terraform").is_dir() or any(path.glob("*.tf")):
            infra.append("terraform")
        if (path / ".github" / "workflows").is_dir():
            infra.append("github-actions")
        if (path / "nginx.conf").exists() or (path / "nginx").is_dir():
            infra.append("nginx")

        # Check docker-compose for services
        for compose_file in ["docker-compose.yml", "docker-compose.yaml"]:
            compose_path = path / compose_file
            if compose_path.exists():
                try:
                    text = compose_path.read_text(encoding="utf-8").lower()
                    if "redis" in text:
                        infra.append("redis")
                    if "postgres" in text or "postgresql" in text:
                        infra.append("postgres")
                    if "mongo" in text:
                        infra.append("mongodb")
                    if "rabbitmq" in text:
                        infra.append("rabbitmq")
                    if "kafka" in text:
                        infra.append("kafka")
                except OSError:
                    pass

        return list(dict.fromkeys(infra))

    def _detect_test_frameworks(self, path: Path) -> list[str]:
        tests: list[str] = []

        pkg_json = path / "package.json"
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text(encoding="utf-8"))
                all_deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
                if "playwright" in all_deps or "@playwright/test" in all_deps:
                    tests.append("playwright")
                if "cypress" in all_deps:
                    tests.append("cypress")
                if "jest" in all_deps:
                    tests.append("jest")
                if "vitest" in all_deps:
                    tests.append("vitest")
                if "mocha" in all_deps:
                    tests.append("mocha")
            except (json.JSONDecodeError, OSError):
                pass

        # Python test frameworks
        if (path / "pytest.ini").exists() or (path / "conftest.py").exists():
            tests.append("pytest")
        pyproject = path / "pyproject.toml"
        if pyproject.exists():
            try:
                text = pyproject.read_text(encoding="utf-8").lower()
                if "pytest" in text:
                    tests.append("pytest")
            except OSError:
                pass

        if (path / "playwright.config.ts").exists() or (path / "playwright.config.js").exists():
            if "playwright" not in tests:
                tests.append("playwright")
        if (path / "cypress.config.ts").exists() or (path / "cypress.config.js").exists():
            if "cypress" not in tests:
                tests.append("cypress")

        return list(dict.fromkeys(tests))

    def _detect_services(self, path: Path) -> list[str]:
        """Detect running services based on config files."""
        services: list[str] = []
        pkg_json = path / "package.json"
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text(encoding="utf-8"))
                scripts = data.get("scripts", {})
                if "dev" in scripts or "start" in scripts:
                    services.append("dev-server")
                if "build" in scripts:
                    services.append("build")
            except (json.JSONDecodeError, OSError):
                pass

        if (path / "manage.py").exists():
            services.append("django-server")
        if any(path.glob("**/uvicorn*")) or any(path.glob("**/gunicorn*")):
            services.append("python-server")

        return services

    def _calculate_risk(self, info: ProjectInfo) -> str:
        score = 0
        if info.frontend and info.backend:
            score += 2
        if info.docker:
            score += 1
        if "kubernetes" in info.infra:
            score += 2
        if len(info.frameworks) > 3:
            score += 1
        if not info.test_frameworks:
            score += 2
        if info.type == "monorepo":
            score += 1

        if score >= 5:
            return "critical"
        if score >= 3:
            return "high"
        if score >= 1:
            return "medium"
        return "low"
