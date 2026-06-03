from __future__ import annotations

from pathlib import Path


def persist_network_failures(path: Path, failures: list[str]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(failures), encoding="utf-8")
    return path


def detect_failed_api_calls(status_codes: list[int]) -> list[str]:
    return [f"HTTP {code}" for code in status_codes if code >= 400]


def detect_websocket_disconnect(events: list[str]) -> bool:
    return any("disconnect" in event.lower() or "close" in event.lower() for event in events)
