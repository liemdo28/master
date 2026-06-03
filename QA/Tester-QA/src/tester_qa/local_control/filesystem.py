from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class ProjectStructure:
    path: str
    files: list[str] = field(default_factory=list)
    directories: list[str] = field(default_factory=list)
    config_files: list[str] = field(default_factory=list)
    env_examples: list[str] = field(default_factory=list)
    test_folders: list[str] = field(default_factory=list)
    logs: list[str] = field(default_factory=list)
    package_manager: str = "unknown"
    framework: str = "unknown"

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class FilesystemInspector:
    def scan_project(self, path: Path | str, max_files: int = 500) -> ProjectStructure:
        root = Path(path).expanduser().resolve()
        if not root.exists():
            raise FileNotFoundError(root)
        files: list[str] = []
        directories: list[str] = []
        for item in sorted(root.rglob("*")):
            if _skip(item):
                continue
            relative = str(item.relative_to(root))
            if item.is_dir():
                directories.append(relative)
            else:
                files.append(relative)
            if len(files) >= max_files:
                break
        return ProjectStructure(
            path=str(root),
            files=files,
            directories=directories,
            config_files=[item for item in files if Path(item).name in _CONFIG_NAMES],
            env_examples=[item for item in files if ".env" in Path(item).name and ("example" in item or "sample" in item)],
            test_folders=[item for item in directories if Path(item).name in {"tests", "test", "__tests__", "spec"}],
            logs=[item for item in files if item.endswith((".log", ".out")) or "/logs/" in item],
            package_manager=_detect_package_manager(files),
            framework=_detect_framework(files),
        )

    def read_source_file(self, path: Path | str, max_bytes: int = 200_000) -> str:
        target = Path(path).expanduser().resolve()
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(target)
        if target.stat().st_size > max_bytes:
            raise ValueError(f"file too large to read safely: {target}")
        return target.read_text(encoding="utf-8", errors="replace")


_CONFIG_NAMES = {
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "next.config.js",
    "next.config.mjs",
    "vite.config.js",
    "vite.config.ts",
    "docker-compose.yml",
    "Dockerfile",
    "pytest.ini",
    "playwright.config.ts",
    "playwright.config.js",
}


def _skip(path: Path) -> bool:
    return any(part in {".git", ".next", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"} for part in path.parts)


def _detect_package_manager(files: list[str]) -> str:
    names = {Path(item).name for item in files}
    if "pnpm-lock.yaml" in names:
        return "pnpm"
    if "yarn.lock" in names:
        return "yarn"
    if "package-lock.json" in names or "package.json" in names:
        return "npm"
    if "uv.lock" in names:
        return "uv"
    if "poetry.lock" in names:
        return "poetry"
    if "requirements.txt" in names or "pyproject.toml" in names:
        return "pip"
    return "unknown"


def _detect_framework(files: list[str]) -> str:
    names = {Path(item).name for item in files}
    joined = "\n".join(files).lower()
    if "next.config.js" in names or "next.config.mjs" in names:
        return "Next.js"
    if "vite.config.ts" in names or "vite.config.js" in names:
        return "React/Vite"
    if "main.py" in names and "fastapi" in joined:
        return "FastAPI"
    if "app.py" in names:
        return "Flask/Python"
    if "server.js" in names or "app.js" in names:
        return "Express/Node"
    if "package.json" in names:
        return "Node"
    if "pyproject.toml" in names or "requirements.txt" in names:
        return "Python"
    return "unknown"
