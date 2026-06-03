from __future__ import annotations

from pathlib import Path

from tester_qa.executor import CommandExecutor
from tester_qa.local_control.audit import AuditLog
from tester_qa.local_control.permission import PermissionGate, PermissionMode
from tester_qa.models import CommandResult


class SafeShell:
    def __init__(self, audit_log: AuditLog | None = None, permission_gate: PermissionGate | None = None) -> None:
        self.audit_log = audit_log or AuditLog()
        self.permission_gate = permission_gate or PermissionGate()

    def run(
        self,
        command: str,
        cwd: Path | str | None = None,
        mode: PermissionMode = PermissionMode.DRY_RUN,
        timeout_seconds: int = 30,
        retries: int = 0,
    ) -> CommandResult:
        decision = self.permission_gate.evaluate_command(command, mode)
        target = str(cwd or Path.cwd())
        if not decision.allowed:
            self.audit_log.record("SafeShell", target, command, mode.value, "failed")
            return CommandResult(False, 126, 0, "", self.permission_gate.approval_prompt(target, command, decision), command)
        if mode == PermissionMode.DRY_RUN:
            self.audit_log.record("SafeShell", target, command, mode.value, "success")
            return CommandResult(True, 0, 0, f"DRY RUN: {command}", "", command)
        result = CommandExecutor(default_timeout_seconds=timeout_seconds, max_retries=retries).run(
            command,
            cwd=cwd,
            timeout_seconds=timeout_seconds,
            retries=retries,
        )
        self.audit_log.record("SafeShell", target, command, mode.value, "success" if result.success else "failed")
        return result
