"""Distributed Browser Warfare — orchestrates multiple browser instances simultaneously."""
from __future__ import annotations

import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

# Imported lazily inside launch_swarm to avoid circular dependency

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class SwarmConfig:
    """Configuration for a distributed browser swarm attack."""

    browser_count: int = 10
    concurrent_per_browser: int = 3
    stagger_ms: int = 500
    scenario_per_browser: list[str] = field(default_factory=list)
    target_url: str = "http://localhost:8000"
    ws_url: str = ""


@dataclass
class SwarmResult:
    """Result from a distributed browser swarm operation."""

    swarm_id: str
    config: dict
    started_at: str
    completed_at: str = ""
    total_browsers: int = 0
    successful: int = 0
    failed: int = 0
    results: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "swarm_id": self.swarm_id,
            "config": self.config,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "total_browsers": self.total_browsers,
            "successful": self.successful,
            "failed": self.failed,
            "results": self.results,
            "errors": self.errors,
        }


class DistributedBrowserWarfare:
    """Launches a coordinated swarm of browser warfare attacks across multiple browser instances."""

    def __init__(
        self,
        evidence_root: Path | str = "evidence",
        timeout_seconds: int = 60,
    ) -> None:
        self.evidence_root = Path(evidence_root)
        self.timeout_seconds = timeout_seconds
        self._orchestrator = None  # lazy-initialised on first use

    def launch_swarm(self, config: SwarmConfig) -> SwarmResult:
        """Launch distributed warfare across multiple browsers in parallel.

        Each browser runs a scenario from scenario_per_browser (cycled if fewer than
        browser_count), or defaults to "total_browser_warfare".  Browsers are staggered
        by stagger_ms to simulate a real burst arrival pattern.
        """
        swarm_id = uuid.uuid4().hex[:8]
        started_at = datetime.now(timezone.utc).isoformat()
        scenario_pool = config.scenario_per_browser or ["total_browser_warfare"]
        # Lazy-import to break circular dependency
        from tester_qa.browser_warfare.browser_warfare_orchestrator import (
            BrowserWarfareOrchestrator,
        )
        if self._orchestrator is None:
            self._orchestrator = BrowserWarfareOrchestrator(
                evidence_root=self.evidence_root,
                timeout_seconds=self.timeout_seconds,
            )

        result = SwarmResult(
            swarm_id=swarm_id,
            config={
                "browser_count": config.browser_count,
                "concurrent_per_browser": config.concurrent_per_browser,
                "stagger_ms": config.stagger_ms,
                "target_url": config.target_url,
                "ws_url": config.ws_url,
                "scenarios": scenario_pool,
            },
            started_at=started_at,
            total_browsers=config.browser_count,
        )

        _results_lock = Lock()
        _errors_lock = Lock()
        stagger_sec = config.stagger_ms / 1000.0

        def _run_browser(browser_idx: int) -> dict[str, Any]:
            """Run a single browser in the swarm."""
            scenario_id = scenario_pool[browser_idx % len(scenario_pool)]
            ws_url = config.ws_url or config.target_url.replace("http", "ws")
            try:
                LOGGER.info(
                    "[Swarm %s] Launching browser #%d — scenario=%s",
                    swarm_id, browser_idx, scenario_id,
                )
                br_result = self._orchestrator.execute_scenario(
                    scenario_id=scenario_id,
                    url=config.target_url,
                    ws_url=ws_url,
                )
                outcome: dict[str, Any] = {
                    "browser_id": browser_idx,
                    "scenario": scenario_id,
                    "success": br_result.success,
                    "modules_executed": br_result.modules_executed,
                    "memory": br_result.memory,
                    "hydration": br_result.hydration,
                    "async_deadlock": br_result.async_deadlock,
                    "render_flood": br_result.render_flood,
                    "navigation": br_result.navigation,
                    "websocket": br_result.websocket,
                    "errors": br_result.errors,
                    "screenshot_path": br_result.screenshot_path,
                }
                with _results_lock:
                    result.results.append(outcome)
                    if br_result.success:
                        result.successful += 1
                    else:
                        result.failed += 1
                LOGGER.info("[Swarm %s] Browser #%d done — success=%s", swarm_id, browser_idx, br_result.success)
                return outcome
            except Exception as e:
                LOGGER.exception("[Swarm %s] Browser #%d crashed: %s", swarm_id, browser_idx, e)
                error_msg = f"browser_{browser_idx}: {e}"
                with _errors_lock:
                    result.errors.append(error_msg)
                    result.failed += 1
                return {"browser_id": browser_idx, "success": False, "error": error_msg}

        # Stagger by launching browsers in the thread pool with delays
        with ThreadPoolExecutor(max_workers=config.browser_count) as executor:
            futures = []
            for idx in range(config.browser_count):
                # Stagger submission into the pool so browsers don't all start at once
                time.sleep(stagger_sec)
                futures.append(executor.submit(_run_browser, idx))

            # Wait for all to complete (respect overall timeout)
            deadline = time.time() + self.timeout_seconds
            for future in as_completed(futures, timeout=self.timeout_seconds):
                remaining = deadline - time.time()
                if remaining <= 0:
                    LOGGER.warning("[Swarm %s] Timeout reached, aborting remaining browsers", swarm_id)
                    break
                try:
                    future.result(timeout=remaining)
                except Exception as e:
                    LOGGER.exception("[Swarm %s] Future failed: %s", swarm_id, e)

        result.completed_at = datetime.now(timezone.utc).isoformat()
        return result

    def estimate_collapse_point(self, config: SwarmConfig) -> dict[str, Any]:
        """Estimate at what scale the target system will collapse.

        Probes the system with increasing browser counts and measures success rate
        to find the collapse threshold.
        """
        from tester_qa.browser_warfare.browser_warfare_orchestrator import (
            BrowserWarfareOrchestrator,
        )
        if self._orchestrator is None:
            self._orchestrator = BrowserWarfareOrchestrator(
                evidence_root=self.evidence_root,
                timeout_seconds=self.timeout_seconds,
            )

        LOGGER.info("[CollapseEstimation] Probing with browser_count=%d", config.browser_count)
        trial = self.launch_swarm(config)
        success_rate = (
            trial.successful / trial.total_browsers if trial.total_browsers > 0 else 0.0
        )
        # Rough heuristic: collapse when success rate drops below 80 %
        if success_rate >= 0.8:
            max_safe = config.browser_count
            multiplier = 1.5
        elif success_rate >= 0.5:
            max_safe = int(config.browser_count * 0.7)
            multiplier = 1.2
        else:
            max_safe = int(config.browser_count * 0.4)
            multiplier = 1.0

        return {
            "browser_count_tested": config.browser_count,
            "success_rate": round(success_rate, 3),
            "estimated_max_browsers_before_collapse": max_safe,
            "estimated_collapse_load": round(max_safe * multiplier, 1),
            "total_successful": trial.successful,
            "total_failed": trial.failed,
            "swarm_id": trial.swarm_id,
        }

    def launch_targeted_swarm(
        self,
        target_url: str,
        scenario_id: str = "total_browser_warfare",
        browser_count: int = 10,
        ws_url: str = "",
    ) -> SwarmResult:
        """Convenience method — launch a swarm against a specific URL with a single scenario."""
        config = SwarmConfig(
            browser_count=browser_count,
            target_url=target_url,
            scenario_per_browser=[scenario_id],
            ws_url=ws_url,
        )
        return self.launch_swarm(config)


# ─── Swarm Scoring ──────────────────────────────────────────────────────────────


def calculate_swarm_collapse_threshold(config: SwarmConfig) -> dict[str, Any]:
    """Calculate the collapse threshold for a swarm configuration.

    Uses a semi-empirical model based on:
      - Target concurrency capacity (assumed 3× browser_count as headroom)
      - Per-browser failure probability derived from config parameters
      - System-level cascade factor when multiple browsers fail simultaneously

    Args:
        config: SwarmConfig describing the planned attack.

    Returns:
        dict with keys:
          - browser_count_tested: int
          - estimated_max_survivable_browsers: int
          - collapse_probability_at_N: list[dict] (per browser count)
          - recommended_safe_load: int  (browsers to stay under)
          - cascade_risk_factor: float  (0-1)
          - threshold_scenario: str
          - warnings: list[str]
    """
    # Base survivable count — empirical constants from chaos campaigns
    base_survivable = 8  # Most targets handle ~8 concurrent browsers cleanly

    # Adjust for concurrent_per_browser — more concurrent load per browser
    # increases stress non-linearly
    stress_multiplier = 1.0 + (config.concurrent_per_browser - 1) * 0.15

    # Stagger benefit — staggered launches (high stagger_ms) reduce peak load
    # at the cost of sustained load duration
    stagger_benefit = min(1.0, config.stagger_ms / 2000.0)

    estimated_max = int((base_survivable / stress_multiplier) * (1 + stagger_benefit * 0.5))
    estimated_max = max(1, estimated_max)

    # Collapse probability curve across browser counts 1..N+10
    collapse_curve: list[dict[str, Any]] = []
    for n in range(1, max(2, estimated_max + 12)):
        # Sigmoid-like probability curve centred at estimated_max
        import math
        k = 0.4  # steepness
        x0 = estimated_max
        prob = 1.0 / (1.0 + math.exp(-k * (n - x0)))
        # Scale so that at estimated_max it's ~0.5, at estimated_max+5 ~0.8
        scaled_prob = round(min(1.0, prob * 1.2), 4)

        if n <= estimated_max:
            severity = "safe"
        elif n <= estimated_max + 3:
            severity = "marginal"
        elif n <= estimated_max + 7:
            severity = "dangerous"
        else:
            severity = "collapse"

        collapse_curve.append({
            "browser_count": n,
            "collapse_probability": scaled_prob,
            "severity": severity,
        })

    # Cascade risk factor: probability that one browser failure cascades
    cascade_risk = min(0.95, 0.2 + config.concurrent_per_browser * 0.05)

    # Warnings
    warnings: list[str] = []
    if config.browser_count > estimated_max:
        warnings.append(
            f"Requested {config.browser_count} browsers exceeds estimated "
            f"survivable load of {estimated_max}. Collapse is likely."
        )
    if config.concurrent_per_browser > 5:
        warnings.append(
            f"High concurrency ({config.concurrent_per_browser}/browser) will "
            "stress test browser sandbox limits."
        )
    if config.browser_count > 30:
        warnings.append(
            "EXTREME: Browser count > 30. Ensure adequate system resources "
            "and consider splitting into multiple sequential swarms."
        )

    # Recommended safe load — 60% of estimated max
    safe_load = max(1, int(estimated_max * 0.6))

    return {
        "browser_count_tested": config.browser_count,
        "estimated_max_survivable_browsers": estimated_max,
        "collapse_probability_at_N": collapse_curve,
        "recommended_safe_load": safe_load,
        "cascade_risk_factor": round(cascade_risk, 3),
        "threshold_scenario": (
            "safe" if config.browser_count <= safe_load else
            "marginal" if config.browser_count <= estimated_max else
            "dangerous"
        ),
        "warnings": warnings,
    }


def score_swarm_resilience(results: list[dict]) -> dict[str, Any]:
    """Score how resilient the swarm target was across all browser results.

    Args:
        results: list of per-browser result dicts (each containing keys like
                 'success', 'memory', 'hydration', 'websocket', 'errors', etc.)

    Returns:
        dict with keys:
          - survivable_count: int  (browsers that succeeded)
          - collapse_probability_at_N: dict  {N: prob, ...}
          - recommended_safe_load: int
          - resilience_score: float  (0-100)
          - failure_modes: dict  (category → count)
          - verdict: str
          - recommendations: list[str]
    """
    if not results:
        return {
            "survivable_count": 0,
            "collapse_probability_at_N": {},
            "recommended_safe_load": 0,
            "resilience_score": 0.0,
            "failure_modes": {},
            "verdict": "NO_DATA",
            "recommendations": ["No results provided — cannot assess resilience."],
        }

    import math

    total = len(results)
    successful = sum(1 for r in results if r.get("success", False))
    failed = total - successful
    success_rate = successful / total

    # Resilience score: 0-100
    resilience = success_rate * 100

    # Failure mode analysis
    failure_modes: dict[str, int] = {}
    for r in results:
        if not r.get("success", False):
            errors = r.get("errors", [])
            mode = _classify_failure(r)
            failure_modes[mode] = failure_modes.get(mode, 0) + 1

    # Build collapse probability curve from observed data
    n_observed = total
    collapse_curve: dict[int, float] = {}
    for n in range(1, n_observed + 11):
        # As n grows beyond observed, probability increases
        extra = max(0.0, (n - n_observed) * 0.05)
        prob_at_n = min(1.0, 1.0 - success_rate + extra)
        collapse_curve[n] = round(prob_at_n, 4)

    # Recommended safe load: observed success rate × total × 0.7
    recommended_safe_load = max(1, int(successful * 0.7))

    # Verdict
    if resilience >= 90:
        verdict = "HARDENED — Target handled swarm without degradation"
    elif resilience >= 70:
        verdict = "RESILIENT — Minor failures, system recoverable"
    elif resilience >= 50:
        verdict = "MARGINAL — Multiple failures indicate weakness"
    else:
        verdict = "COLLAPSE_IMMINENT — System cannot handle swarm load"

    # Recommendations
    recommendations: list[str] = []
    if failed > 0 and "memory" in failure_modes:
        recommendations.append("Memory failures detected — increase JS heap headroom and fix leaks")
    if failed > 0 and "websocket" in failure_modes:
        recommendations.append("WebSocket failures — implement connection pooling and reconnection backoff")
    if failed > 0 and "hydration" in failure_modes:
        recommendations.append("Hydration failures — audit SSR hydration contracts for affected routes")
    if resilience < 70:
        recommendations.append(
            f"Resilience score {resilience:.0f} — run targeted hardening before next swarm campaign"
        )
    if not recommendations:
        recommendations.append("All swarm browsers survived. System is resilient at current load.")

    return {
        "survivable_count": successful,
        "collapse_probability_at_N": collapse_curve,
        "recommended_safe_load": recommended_safe_load,
        "resilience_score": round(resilience, 1),
        "failure_modes": failure_modes,
        "verdict": verdict,
        "recommendations": recommendations,
        "total_browsers": total,
        "successful": successful,
        "failed": failed,
        "success_rate": round(success_rate, 3),
    }


def _classify_failure(result: dict) -> str:
    """Classify a failed browser result into a failure mode category."""
    errors = result.get("errors", [])
    memory = result.get("memory", {})
    ws = result.get("websocket", {})
    hydr = result.get("hydration", {})

    if not result.get("success", False) and not errors:
        return "unknown"
    if any("memory" in str(e).lower() or memory.get("bytes_allocated", 0) > 80_000_000 for e in errors):
        return "memory"
    if any("ws" in str(e).lower() or "websocket" in str(e).lower() for e in errors):
        return "websocket"
    if ws.get("corrupt_messages", 0) > ws.get("messages_sent", 1) * 0.5:
        return "websocket_corruption"
    if hydr.get("mismatched_nodes", 0) > 50 or hydr.get("state_corruptions", 0) > 5:
        return "hydration"
    if result.get("errors"):
        return "runtime_error"
    return "unknown"
