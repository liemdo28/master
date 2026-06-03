from __future__ import annotations

from tester_qa.models import Evidence, Recommendation, TestCase


def render_evidence(items: list[Evidence]) -> str:
    if not items:
        return "- No evidence captured yet."
    return "\n".join(
        f"- `{item.source}`: {item.detail}"
        + (f" Metric: `{item.metric}`." if item.metric else "")
        + (f" Evidence: `{item.evidence_id}`." if item.evidence_id else "")
        + (f" Path: `{item.path}`." if item.path else "")
        for item in items
    )


def render_list(items: list[str]) -> str:
    if not items:
        return "- Pending."
    return "\n".join(f"- {item}" for item in items)


def render_recommendations(items: list[Recommendation]) -> str:
    if not items:
        return "- Pending."
    return "\n".join(
        f"- [{item.priority.value.upper()}] {item.action} Owner: {item.owner}."
        for item in items
    )


def render_test_cases(cases: list[TestCase]) -> str:
    if not cases:
        return "- No test cases defined."
    rows = [
        "| Category | Test | Objective | Signal | Expected |",
        "| --- | --- | --- | --- | --- |",
    ]
    rows.extend(
        f"| {case.category.value} | {case.name} | {case.objective} | {case.signal} | {case.expected} |"
        for case in cases
    )
    return "\n".join(rows)
