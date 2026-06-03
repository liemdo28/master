from __future__ import annotations

from tester_qa.stress.models import StressResult


class ProviderFailureSimulator:
    def simulate(self, provider: str, mode: str = "timeout", attempts: int = 10) -> StressResult:
        errors = []
        if mode not in {"timeout", "rate_limit", "invalid_payload", "unavailable"}:
            errors.append(f"Unknown provider failure mode: {mode}")
            return StressResult(provider, "provider_failure_simulation", attempts, 0, attempts, 0, [], errors)
        return StressResult(provider, f"provider_{mode}", attempts, 0, attempts, 0, [], [mode] * attempts)
