from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class PermissionMode(str, Enum):
    READ_ONLY = "read_only"
    DRY_RUN = "dry_run"
    APPROVED_WRITE = "approved_write"
    APPROVED_EXECUTE = "approved_execute"


DANGEROUS_COMMAND_PATTERNS = [
    "rm -rf",
    "sudo",
    "chmod -R",
    "chown -R",
    "kill -9",
    "git reset --hard",
    "git clean -fd",
    "docker system prune",
    "npm publish",
    "pip upload",
    "delete database",
    "drop table",
]


@dataclass(frozen=True)
class PermissionDecision:
    allowed: bool
    risk: str
    reason: str
    approval_required: bool = False
    rollback: str = "Capture state before execution and restore from VCS/backups where applicable."


class PermissionGate:
    def evaluate_command(self, command: str, mode: PermissionMode) -> PermissionDecision:
        hits = [pattern for pattern in DANGEROUS_COMMAND_PATTERNS if pattern in command.lower()]
        if hits and mode != PermissionMode.APPROVED_EXECUTE:
            return PermissionDecision(
                allowed=False,
                risk="high",
                reason=f"Blocked dangerous command pattern: {', '.join(hits)}",
                approval_required=True,
                rollback="Requires explicit rollback plan before execution.",
            )
        if mode == PermissionMode.READ_ONLY and _looks_mutating(command):
            return PermissionDecision(
                allowed=False,
                risk="medium",
                reason="Read-only mode blocks mutating command.",
                approval_required=True,
            )
        return PermissionDecision(allowed=True, risk="low" if not hits else "high", reason="Allowed by current permission mode.")

    def approval_prompt(self, target: str, command: str, decision: PermissionDecision) -> str:
        return "\n".join(
            [
                "ACTION REQUIRES APPROVAL",
                f"Target: {target}",
                f"Command: {command}",
                f"Risk: {decision.risk}",
                f"Reason: {decision.reason}",
                f"Rollback: {decision.rollback}",
                "Proceed?",
            ]
        )


def _looks_mutating(command: str) -> bool:
    tokens = [" install", " add ", " write", "touch ", "mkdir ", "mv ", "cp ", "rm ", "npm run build", "pytest --update"]
    lowered = f" {command.lower()} "
    return any(token in lowered for token in tokens)
