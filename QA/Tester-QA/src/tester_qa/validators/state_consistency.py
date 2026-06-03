from __future__ import annotations


def detect_state_mismatch(expected: dict, observed: dict) -> list[str]:
    mismatches = []
    for key, value in expected.items():
        if observed.get(key) != value:
            mismatches.append(f"{key}: expected={value!r} observed={observed.get(key)!r}")
    return mismatches
