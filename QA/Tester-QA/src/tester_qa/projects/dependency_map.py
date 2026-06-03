from __future__ import annotations

import json
from pathlib import Path


def dependency_map(path: Path | str) -> dict:
    root = Path(path).expanduser().resolve()
    package_json = root / "package.json"
    pyproject = root / "pyproject.toml"
    requirements = root / "requirements.txt"
    payload = {"node": [], "python": []}
    if package_json.exists():
        try:
            data = json.loads(package_json.read_text(encoding="utf-8"))
            payload["node"] = sorted({*data.get("dependencies", {}), *data.get("devDependencies", {})})
        except json.JSONDecodeError:
            payload["node"] = ["package.json malformed"]
    if requirements.exists():
        payload["python"].extend(line.strip() for line in requirements.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#"))
    if pyproject.exists():
        text = pyproject.read_text(encoding="utf-8", errors="replace")
        if "dependencies" in text:
            payload["python"].append("pyproject dependencies present")
    return payload
