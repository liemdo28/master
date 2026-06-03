from __future__ import annotations

import json
from pathlib import Path

from tester_qa.local_control.filesystem import FilesystemInspector, ProjectStructure


class ProjectScanner:
    def __init__(self, filesystem: FilesystemInspector | None = None) -> None:
        self.filesystem = filesystem or FilesystemInspector()

    def identify(self, path: Path | str) -> dict:
        structure = self.filesystem.scan_project(path)
        package_json = Path(structure.path) / "package.json"
        scripts = {}
        dependencies: dict = {}
        if package_json.exists():
            try:
                payload = json.loads(package_json.read_text(encoding="utf-8"))
                scripts = payload.get("scripts", {})
                dependencies = {**payload.get("dependencies", {}), **payload.get("devDependencies", {})}
            except json.JSONDecodeError:
                scripts = {}
        files = set(structure.files)
        return {
            "path": structure.path,
            "type": _project_type(structure),
            "framework": structure.framework,
            "package_manager": structure.package_manager,
            "has_readme": any(Path(item).name.lower().startswith("readme") for item in files),
            "has_env_example": bool(structure.env_examples),
            "has_docker": "Dockerfile" in files or "docker-compose.yml" in files,
            "uses_sqlite": any("sqlite" in item.lower() or item.endswith(".db") for item in files) or "sqlite3" in dependencies,
            "uses_postgres": any("postgres" in item.lower() for item in files) or "pg" in dependencies or "psycopg" in dependencies,
            "test_framework": _detect_test_framework(structure, scripts, dependencies),
            "entrypoints": _entrypoints(structure, scripts),
            "test_commands": _test_commands(structure, scripts),
            "dev_commands": _script_commands(scripts, ["dev", "start"]),
            "config_files": structure.config_files,
            "logs": structure.logs,
        }


def _project_type(structure: ProjectStructure) -> str:
    has_node = any(Path(item).name == "package.json" for item in structure.files)
    has_python = any(Path(item).name in {"pyproject.toml", "requirements.txt"} or item.endswith(".py") for item in structure.files)
    if has_node and has_python:
        return "mixed"
    if has_node:
        return "node"
    if has_python:
        return "python"
    return "unknown"


def _detect_test_framework(structure: ProjectStructure, scripts: dict, dependencies: dict) -> str:
    names = set(dependencies) | set(scripts)
    if "playwright" in names or any("playwright.config" in item for item in structure.files):
        return "Playwright"
    if "jest" in names:
        return "Jest"
    if "vitest" in names:
        return "Vitest"
    if any(Path(item).name in {"pytest.ini", "conftest.py"} for item in structure.files):
        return "pytest"
    if structure.test_folders:
        return "unknown-tests-present"
    return "none"


def _entrypoints(structure: ProjectStructure, scripts: dict) -> list[str]:
    entries = []
    for candidate in ["main.py", "app.py", "server.js", "src/main.tsx", "src/App.tsx"]:
        if candidate in structure.files:
            entries.append(candidate)
    for name in ["dev", "start"]:
        if name in scripts:
            entries.append(f"npm run {name}")
    return entries


def _script_commands(scripts: dict, names: list[str]) -> list[str]:
    return [f"npm run {name}" for name in names if name in scripts]


def _test_commands(structure: ProjectStructure, scripts: dict) -> list[str]:
    commands = _script_commands(scripts, ["test", "pytest", "unit", "e2e"])
    has_python_config = any(Path(item).name in {"pyproject.toml", "requirements.txt"} for item in structure.files)
    if structure.test_folders and (structure.package_manager in {"pip", "uv", "poetry"} or has_python_config):
        commands.append("PYTHONPATH=src python3 -m unittest discover -s tests")
    return commands
