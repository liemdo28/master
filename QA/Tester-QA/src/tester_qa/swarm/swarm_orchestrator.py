"""Human-like user swarm — simulate chaotic, impatient, destructive real users."""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class SwarmUser:
    user_id: int
    behavior: str  # normal | impatient | rage | multi_tab | reconnect_loop
    actions_performed: int = 0
    errors_caused: int = 0
    session_duration_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "behavior": self.behavior,
            "actions": self.actions_performed,
            "errors_caused": self.errors_caused,
            "session_ms": self.session_duration_ms,
        }


@dataclass
class SwarmResult:
    total_users: int
    total_actions: int
    total_errors: int
    behaviors: dict[str, int]
    system_impact: dict[str, Any]
    collapse_triggered: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_users": self.total_users,
            "total_actions": self.total_actions,
            "total_errors": self.total_errors,
            "error_rate": round(self.total_errors / max(self.total_actions, 1) * 100, 1),
            "behaviors": self.behaviors,
            "system_impact": self.system_impact,
            "collapse_triggered": self.collapse_triggered,
        }


BEHAVIORS = ["normal", "impatient", "rage", "multi_tab", "reconnect_loop", "auth_spam", "refresh_mania"]

BEHAVIOR_WEIGHTS = {
    "normal": 0.4,
    "impatient": 0.2,
    "rage": 0.1,
    "multi_tab": 0.1,
    "reconnect_loop": 0.08,
    "auth_spam": 0.05,
    "refresh_mania": 0.07,
}


class SwarmOrchestrator:
    """Orchestrate human-like user swarms to stress-test systems realistically."""

    def __init__(self) -> None:
        self.users: list[SwarmUser] = []
        self.results: list[SwarmResult] = []

    def generate_swarm(self, count: int = 50) -> list[SwarmUser]:
        """Generate a swarm of users with realistic behavior distribution."""
        self.users = []
        behaviors = list(BEHAVIOR_WEIGHTS.keys())
        weights = list(BEHAVIOR_WEIGHTS.values())

        for i in range(count):
            behavior = random.choices(behaviors, weights=weights, k=1)[0]
            self.users.append(SwarmUser(user_id=i, behavior=behavior))

        return self.users

    def simulate_session(self, user: SwarmUser) -> SwarmUser:
        """Simulate a single user session based on their behavior type."""
        behavior_actions = {
            "normal": (5, 15, 0.02),      # (min_actions, max_actions, error_probability)
            "impatient": (10, 30, 0.05),
            "rage": (20, 50, 0.15),
            "multi_tab": (15, 40, 0.08),
            "reconnect_loop": (3, 10, 0.20),
            "auth_spam": (5, 20, 0.12),
            "refresh_mania": (10, 60, 0.10),
        }

        min_a, max_a, error_prob = behavior_actions.get(user.behavior, (5, 15, 0.02))
        actions = random.randint(min_a, max_a)
        errors = sum(1 for _ in range(actions) if random.random() < error_prob)

        user.actions_performed = actions
        user.errors_caused = errors
        user.session_duration_ms = random.gauss(30000, 15000)
        if user.session_duration_ms < 1000:
            user.session_duration_ms = 1000

        return user

    def run_swarm(self, count: int = 50, target_url: str = "http://localhost:3000") -> SwarmResult:
        """Run a full user swarm simulation."""
        users = self.generate_swarm(count)

        for user in users:
            self.simulate_session(user)

        total_actions = sum(u.actions_performed for u in users)
        total_errors = sum(u.errors_caused for u in users)
        behaviors = {}
        for u in users:
            behaviors[u.behavior] = behaviors.get(u.behavior, 0) + 1

        # Calculate system impact
        rage_users = sum(1 for u in users if u.behavior == "rage")
        multi_tab_users = sum(1 for u in users if u.behavior == "multi_tab")
        reconnect_users = sum(1 for u in users if u.behavior == "reconnect_loop")

        websocket_pressure = (multi_tab_users * 3 + reconnect_users * 5) / max(count, 1)
        api_pressure = total_actions / (count * 10)
        auth_pressure = sum(1 for u in users if u.behavior == "auth_spam") * 4 / max(count, 1)

        collapse_triggered = websocket_pressure > 0.5 or api_pressure > 2.0

        system_impact = {
            "websocket_pressure": round(websocket_pressure, 3),
            "api_pressure": round(api_pressure, 3),
            "auth_pressure": round(auth_pressure, 3),
            "estimated_concurrent_connections": count + multi_tab_users * 3,
            "estimated_websocket_reconnects": reconnect_users * random.randint(3, 10),
            "rage_click_events": rage_users * random.randint(10, 30),
            "duplicate_submissions_risk": rage_users > count * 0.1,
        }

        result = SwarmResult(
            total_users=count,
            total_actions=total_actions,
            total_errors=total_errors,
            behaviors=behaviors,
            system_impact=system_impact,
            collapse_triggered=collapse_triggered,
        )
        self.results.append(result)
        return result

    def run_escalating_swarm(self, start: int = 10, end: int = 200, step: int = 20) -> dict[str, Any]:
        """Run swarm with increasing user count to find breaking point."""
        rounds: list[dict[str, Any]] = []
        breaking_point: int | None = None

        for count in range(start, end + 1, step):
            result = self.run_swarm(count)
            rounds.append({"users": count, "result": result.to_dict()})
            if result.collapse_triggered and breaking_point is None:
                breaking_point = count

        return {
            "start_users": start,
            "end_users": end,
            "breaking_point": breaking_point,
            "rounds": rounds,
            "assessment": {
                "max_safe_users": (breaking_point - step) if breaking_point else end,
                "collapse_behavior": "websocket_saturation" if breaking_point else "none_detected",
                "recommendation": f"System stable up to ~{(breaking_point - step) if breaking_point else end} concurrent users",
            },
        }

    def get_behavior_analysis(self) -> dict[str, Any]:
        """Analyze which user behaviors cause the most damage."""
        if not self.users:
            return {"error": "No swarm data — run a swarm first"}

        behavior_damage: dict[str, dict[str, float]] = {}
        for user in self.users:
            if user.behavior not in behavior_damage:
                behavior_damage[user.behavior] = {"total_errors": 0, "total_actions": 0, "count": 0}
            behavior_damage[user.behavior]["total_errors"] += user.errors_caused
            behavior_damage[user.behavior]["total_actions"] += user.actions_performed
            behavior_damage[user.behavior]["count"] += 1

        analysis: list[dict[str, Any]] = []
        for behavior, stats in behavior_damage.items():
            error_rate = stats["total_errors"] / max(stats["total_actions"], 1)
            analysis.append({
                "behavior": behavior,
                "users": int(stats["count"]),
                "error_rate": round(error_rate * 100, 1),
                "total_errors": int(stats["total_errors"]),
                "damage_potential": "high" if error_rate > 0.1 else "medium" if error_rate > 0.05 else "low",
            })

        return {"behaviors": sorted(analysis, key=lambda x: x["error_rate"], reverse=True)}
