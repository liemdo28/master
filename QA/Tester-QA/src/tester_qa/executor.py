from __future__ import annotations

import logging
import subprocess
import time
from collections.abc import Mapping, Sequence
from pathlib import Path

from tester_qa.models import CommandResult


LOGGER = logging.getLogger(__name__)


class CommandExecutor:
    def __init__(self, default_timeout_seconds: int = 30, max_retries: int = 0) -> None:
        if default_timeout_seconds <= 0:
            raise ValueError("default_timeout_seconds must be positive")
        if max_retries < 0:
            raise ValueError("max_retries cannot be negative")
        self.default_timeout_seconds = default_timeout_seconds
        self.max_retries = max_retries

    def run(
        self,
        command: str | Sequence[str],
        cwd: Path | str | None = None,
        timeout_seconds: int | None = None,
        retries: int | None = None,
        env: Mapping[str, str] | None = None,
    ) -> CommandResult:
        timeout = timeout_seconds or self.default_timeout_seconds
        if timeout <= 0:
            raise ValueError("timeout_seconds must be positive")

        max_attempts = (self.max_retries if retries is None else retries) + 1
        if max_attempts <= 0:
            raise ValueError("retries cannot be negative")

        display_command = command if isinstance(command, str) else " ".join(command)
        last_result: CommandResult | None = None

        for attempt in range(1, max_attempts + 1):
            LOGGER.info("executing command", extra={"command": display_command, "attempt": attempt})
            started = time.monotonic()
            try:
                completed = subprocess.run(
                    command,
                    cwd=str(cwd) if cwd else None,
                    env=dict(env) if env else None,
                    shell=isinstance(command, str),
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    check=False,
                    start_new_session=True,
                )
                duration_ms = int((time.monotonic() - started) * 1000)
                last_result = CommandResult(
                    success=completed.returncode == 0,
                    exit_code=completed.returncode,
                    duration_ms=duration_ms,
                    stdout=completed.stdout,
                    stderr=completed.stderr,
                    command=display_command,
                    attempts=attempt,
                )
            except subprocess.TimeoutExpired as exc:
                duration_ms = int((time.monotonic() - started) * 1000)
                last_result = CommandResult(
                    success=False,
                    exit_code=124,
                    duration_ms=duration_ms,
                    stdout=_decode_timeout_output(exc.stdout),
                    stderr=_decode_timeout_output(exc.stderr) or f"Command timed out after {timeout} seconds.",
                    command=display_command,
                    timed_out=True,
                    attempts=attempt,
                )

            if last_result.success:
                return last_result
            LOGGER.warning(
                "command failed",
                extra={
                    "command": display_command,
                    "attempt": attempt,
                    "exit_code": last_result.exit_code,
                    "timed_out": last_result.timed_out,
                },
            )

        if last_result is None:
            raise RuntimeError("command execution did not produce a result")
        return last_result


def _decode_timeout_output(value: str | bytes | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    return value
