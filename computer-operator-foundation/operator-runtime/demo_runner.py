"""
Shared demo helpers used by every Phase 2B demo.
"""
import sys
import time
from pathlib import Path
from typing import Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from policy_guard import check_target, classify_target  # noqa: E402
from telemetry import (  # noqa: E402
    create_run,
    record_action,
    add_screenshot,
    add_download,
    add_evidence,
    complete_run,
    fail_run,
)
from evidence_registry import register_evidence  # noqa: E402
from coordination import (  # noqa: E402
    create_coordination_task,
    dispatch_task,
    start_task,
    complete_task,
    fail_task,
    attach_evidence,
    attach_run,
)

import json as _json  # noqa: E402

EVIDENCE_DIR = HERE / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)


def _persist_coordination_task(task: dict):
    """Persist coordination task to disk for cross-process dashboard reads."""
    f = EVIDENCE_DIR / f"{task['coord_task_id']}_coordination.json"
    f.write_text(_json.dumps(task, indent=2, default=str), encoding="utf-8")


class DemoRun:
    """Helper for executing a demo with full governance and telemetry."""

    def __init__(
        self,
        demo_name: str,
        target: str,
        adapter: str = "playwright-chromium",
        mode: str = "sandbox",
        approval_level: str = "SAFE_WRITE",
    ):
        self.demo_name = demo_name
        self.target = target
        self.adapter = adapter
        self.mode = mode
        self.approval_level = approval_level

        # Policy check
        self.policy_decision = check_target(target)
        if not self.policy_decision["ok"]:
            raise RuntimeError(
                f"POLICY BLOCK: target '{target}' is not allowed. "
                f"status={self.policy_decision['status']}"
            )

        # Coordination task
        from telemetry import new_task_id, new_objective_id
        self.task_id = new_task_id()
        self.objective_id = new_objective_id()

        self.coord_task = create_coordination_task(
            task_name=demo_name,
            objective_id=self.objective_id,
            target=target,
            approval_level=approval_level,
            operator_type="web",
        )
        dispatch_task(self.coord_task["coord_task_id"])
        start_task(self.coord_task["coord_task_id"])

        # Telemetry run
        self.run = create_run(
            task_id=self.task_id,
            objective_id=self.objective_id,
            adapter=adapter,
            mode=mode,
            target=target,
            policy_decision=self.policy_decision,
        )
        attach_run(self.coord_task["coord_task_id"], self.run["run_id"])
        _persist_coordination_task(self.coord_task)

    def action(self, action_type: str, detail: str, success: bool = True, error: Optional[str] = None):
        record_action(self.run["run_id"], action_type, detail, success=success, error=error)

    def screenshot(self, file_path: str, description: str = ""):
        add_screenshot(self.run["run_id"], file_path)
        ev = register_evidence(
            evidence_type="screenshot",
            source_run_id=self.run["run_id"],
            source_task_id=self.task_id,
            file_path=file_path,
            description=description or f"screenshot from {self.demo_name}",
        )
        add_evidence(self.run["run_id"], ev["evidence_id"])
        attach_evidence(self.coord_task["coord_task_id"], ev["evidence_id"])
        return ev

    def register_download(self, file_path: str, description: str = ""):
        add_download(self.run["run_id"], file_path)
        ev = register_evidence(
            evidence_type="download_file",
            source_run_id=self.run["run_id"],
            source_task_id=self.task_id,
            file_path=file_path,
            description=description or f"download from {self.demo_name}",
        )
        add_evidence(self.run["run_id"], ev["evidence_id"])
        attach_evidence(self.coord_task["coord_task_id"], ev["evidence_id"])
        return ev

    def register_html(self, file_path: str, description: str = ""):
        ev = register_evidence(
            evidence_type="html_snapshot",
            source_run_id=self.run["run_id"],
            source_task_id=self.task_id,
            file_path=file_path,
            description=description or f"html snapshot from {self.demo_name}",
        )
        add_evidence(self.run["run_id"], ev["evidence_id"])
        attach_evidence(self.coord_task["coord_task_id"], ev["evidence_id"])
        return ev

    def register_log(self, content: dict, description: str = ""):
        ev = register_evidence(
            evidence_type="execution_log",
            source_run_id=self.run["run_id"],
            source_task_id=self.task_id,
            content=content,
            description=description or f"execution log from {self.demo_name}",
        )
        add_evidence(self.run["run_id"], ev["evidence_id"])
        attach_evidence(self.coord_task["coord_task_id"], ev["evidence_id"])
        return ev

    def register_telemetry(self, content: dict, description: str = ""):
        ev = register_evidence(
            evidence_type="telemetry_json",
            source_run_id=self.run["run_id"],
            source_task_id=self.task_id,
            content=content,
            description=description or f"telemetry from {self.demo_name}",
        )
        add_evidence(self.run["run_id"], ev["evidence_id"])
        attach_evidence(self.coord_task["coord_task_id"], ev["evidence_id"])
        return ev

    def register_crawl_summary(self, content: dict, description: str = ""):
        ev = register_evidence(
            evidence_type="crawl_summary",
            source_run_id=self.run["run_id"],
            source_task_id=self.task_id,
            content=content,
            description=description or f"crawl summary from {self.demo_name}",
        )
        add_evidence(self.run["run_id"], ev["evidence_id"])
        attach_evidence(self.coord_task["coord_task_id"], ev["evidence_id"])
        return ev

    def finish(self, success: bool = True, error: Optional[str] = None):
        if success:
            complete_run(self.run["run_id"], success=True)
            complete_task(self.coord_task["coord_task_id"])
        else:
            fail_run(self.run["run_id"], error=error or "unspecified failure")
            fail_task(self.coord_task["coord_task_id"], error=error or "unspecified failure")
        # Persist final coordination state for cross-process dashboard
        _persist_coordination_task(self.coord_task)
        return self.run
