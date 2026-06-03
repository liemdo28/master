"""Chaos Director — adaptive destruction intelligence that escalates until collapse."""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class AttackVector:
    name: str
    category: str  # provider | websocket | memory | queue | network | browser
    intensity: float = 0.5
    combined_with: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "category": self.category, "intensity": self.intensity, "combined_with": self.combined_with}


@dataclass
class ChaosRound:
    round_number: int
    vectors: list[AttackVector]
    system_survived: bool
    health_after: float
    escalation_applied: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "round": self.round_number,
            "vectors": [v.to_dict() for v in self.vectors],
            "survived": self.system_survived,
            "health_after": self.health_after,
            "escalation": self.escalation_applied,
        }


ATTACK_VECTORS = [
    AttackVector("provider_timeout", "provider", 0.3),
    AttackVector("websocket_flood", "websocket", 0.4),
    AttackVector("memory_pressure", "memory", 0.3),
    AttackVector("queue_overflow", "queue", 0.4),
    AttackVector("packet_loss", "network", 0.3),
    AttackVector("browser_refresh_storm", "browser", 0.5),
    AttackVector("retry_amplification", "provider", 0.4),
    AttackVector("connection_exhaustion", "network", 0.5),
    AttackVector("stale_state_injection", "websocket", 0.3),
    AttackVector("auth_token_expiry", "browser", 0.2),
]


class ChaosDirector:
    """Adaptive chaos intelligence — escalates attacks until system breaks."""

    def __init__(self) -> None:
        self.rounds: list[ChaosRound] = []
        self.current_intensity: float = 0.3
        self.escalation_factor: float = 1.3
        self.max_rounds: int = 10
        self.vectors_tried: list[str] = []

    def plan_attack(self, system_health: float = 1.0, previous_survived: bool = True) -> list[AttackVector]:
        """Plan next attack based on system response to previous attacks."""
        if previous_survived:
            # System survived — escalate
            self.current_intensity = min(1.0, self.current_intensity * self.escalation_factor)
            # Add more vectors
            num_vectors = min(len(ATTACK_VECTORS), 1 + len(self.rounds))
        else:
            # System broke — we found the threshold
            return []

        # Select vectors — prefer untried ones, combine for maximum impact
        available = [v for v in ATTACK_VECTORS if v.name not in self.vectors_tried[-3:]]
        if not available:
            available = ATTACK_VECTORS

        selected = random.sample(available, min(num_vectors, len(available)))
        for v in selected:
            v.intensity = self.current_intensity
            v.combined_with = [s.name for s in selected if s != v]
            self.vectors_tried.append(v.name)

        return selected

    def execute_round(self, system_health: float = 1.0) -> ChaosRound:
        """Execute one round of adaptive chaos."""
        previous_survived = system_health > 0.3
        vectors = self.plan_attack(system_health, previous_survived)

        if not vectors:
            # System already broken
            round_result = ChaosRound(
                round_number=len(self.rounds) + 1,
                vectors=[],
                system_survived=False,
                health_after=system_health,
                escalation_applied="none — system already collapsed",
            )
            self.rounds.append(round_result)
            return round_result

        # Simulate attack impact
        damage = sum(v.intensity * 0.15 for v in vectors)
        # Combination bonus — multiple vectors amplify each other
        if len(vectors) > 1:
            damage *= 1 + (len(vectors) - 1) * 0.2

        new_health = max(0.0, system_health - damage)
        survived = new_health > 0.3

        escalation = f"intensity={self.current_intensity:.2f}, vectors={len(vectors)}"
        if not survived:
            escalation += " — COLLAPSE DETECTED"

        round_result = ChaosRound(
            round_number=len(self.rounds) + 1,
            vectors=vectors,
            system_survived=survived,
            health_after=round(new_health, 3),
            escalation_applied=escalation,
        )
        self.rounds.append(round_result)
        return round_result

    def run_full_campaign(self, initial_health: float = 1.0) -> dict[str, Any]:
        """Run a full adaptive chaos campaign until collapse or max rounds."""
        health = initial_health
        self.rounds = []
        self.current_intensity = 0.3
        self.vectors_tried = []

        for _ in range(self.max_rounds):
            round_result = self.execute_round(health)
            health = round_result.health_after
            if not round_result.system_survived:
                break

        collapse_round = next((r.round_number for r in self.rounds if not r.system_survived), None)

        return {
            "total_rounds": len(self.rounds),
            "collapse_at_round": collapse_round,
            "final_health": health,
            "max_intensity_reached": self.current_intensity,
            "vectors_used": list(set(self.vectors_tried)),
            "rounds": [r.to_dict() for r in self.rounds],
            "assessment": {
                "resilience_rating": self._rate_resilience(collapse_round),
                "weakest_category": self._find_weakest_category(),
                "recommended_hardening": self._recommend_hardening(),
            },
        }

    def find_weakpoints(self, system_health: float = 1.0) -> list[dict[str, Any]]:
        """Probe each attack category individually to find weakpoints."""
        weakpoints: list[dict[str, Any]] = []
        categories = set(v.category for v in ATTACK_VECTORS)

        for category in categories:
            category_vectors = [v for v in ATTACK_VECTORS if v.category == category]
            # Simulate category-specific attack
            damage = sum(v.intensity * 0.2 for v in category_vectors)
            remaining_health = max(0.0, system_health - damage)
            weakpoints.append({
                "category": category,
                "vectors": [v.name for v in category_vectors],
                "estimated_damage": round(damage, 3),
                "health_after": round(remaining_health, 3),
                "vulnerability": "high" if damage > 0.3 else "medium" if damage > 0.15 else "low",
            })

        return sorted(weakpoints, key=lambda x: x["estimated_damage"], reverse=True)

    def _rate_resilience(self, collapse_round: int | None) -> str:
        if collapse_round is None:
            return "exceptional"
        if collapse_round >= 8:
            return "strong"
        if collapse_round >= 5:
            return "moderate"
        if collapse_round >= 3:
            return "weak"
        return "fragile"

    def _find_weakest_category(self) -> str:
        if not self.rounds:
            return "unknown"
        # Find which category appeared most in the collapse round
        collapse_rounds = [r for r in self.rounds if not r.system_survived]
        if collapse_rounds:
            vectors = collapse_rounds[0].vectors
            if vectors:
                categories = [v.category for v in vectors]
                return max(set(categories), key=categories.count)
        return "combined"

    def _recommend_hardening(self) -> list[str]:
        recs: list[str] = []
        if self.current_intensity < 0.5:
            recs.append("System is fragile — basic resilience patterns needed")
        weakest = self._find_weakest_category()
        hardening_map = {
            "provider": "Add circuit breakers and provider failover",
            "websocket": "Implement reconnection with state resync",
            "memory": "Add memory limits and garbage collection tuning",
            "queue": "Implement backpressure and dead letter queues",
            "network": "Add retry with jitter and connection pooling",
            "browser": "Implement optimistic UI with rollback",
        }
        if weakest in hardening_map:
            recs.append(hardening_map[weakest])
        recs.append("Add health check granularity per subsystem")
        return recs
