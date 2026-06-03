from __future__ import annotations

from pathlib import Path


def persist_console_errors(path: Path, errors: list[str]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(errors), encoding="utf-8")
    return path


def detect_console_errors(messages: list[str]) -> list[str]:
    return [message for message in messages if any(level in message.lower() for level in ["error", "exception", "failed"])]
