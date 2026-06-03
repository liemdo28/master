from __future__ import annotations

from tester_qa.models import TestPlan
from tester_qa.reporting.common import render_list, render_recommendations, render_test_cases


def render_test_plan(plan: TestPlan) -> str:
    return "\n".join(
        [
            f"# QA Test Plan: {plan.system}",
            "",
            "## Scope",
            plan.scope,
            "",
            "## Test Matrix",
            render_test_cases(plan.cases),
            "",
            "## Bottlenecks",
            render_list(plan.bottlenecks),
            "",
            "## Recommendations",
            render_recommendations(plan.recommendations),
            "",
            f"_Created at: {plan.created_at.isoformat()}_",
        ]
    )
