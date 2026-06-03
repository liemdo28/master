from __future__ import annotations

from tester_qa.local_control.process import ProcessInspector


def audit_processes() -> dict:
    inspector = ProcessInspector()
    return {
        "process_count": len(inspector.list_processes()),
        "occupied_ports": [item.to_dict() for item in inspector.occupied_ports()],
        "high_cpu": [item.to_dict() for item in inspector.detect_high_cpu()],
        "dev_processes": [item.to_dict() for item in inspector.detect_orphans()],
    }
