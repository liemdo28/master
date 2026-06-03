"""Operational Pattern Engine — aggregates forensic intelligence detectors."""
from __future__ import annotations

from datetime import datetime

from tester_qa.intelligence.failure_pattern_detection import FailurePatternDetector
from tester_qa.intelligence.recurring_collapse import RecurringCollapseDetector
from tester_qa.intelligence.websocket_anomaly_patterns import WebSocketAnomalyDetector
from tester_qa.intelligence.provider_behavior_analysis import ProviderBehaviorAnalyzer
from tester_qa.intelligence.runtime_behavior_analysis import RuntimeBehaviorAnalyzer


class OperationalPatternEngine:
    """Runs full operational forensic analysis across failure, collapse, WS, provider, and runtime data."""

    def __init__(self):
        self.failure_detector = FailurePatternDetector()
        self.collapse_detector = RecurringCollapseDetector()
        self.websocket_detector = WebSocketAnomalyDetector()
        self.provider_analyzer = ProviderBehaviorAnalyzer()
        self.runtime_analyzer = RuntimeBehaviorAnalyzer()
        self.last_report: dict = {}

    def run_full_analysis(self, data: dict) -> dict:
        """Run all detectors on provided data and store aggregate report."""
        failures = data.get("failures", []) or data.get("failure_records", []) or []
        collapses = data.get("collapses", []) or data.get("collapse_events", []) or []
        ws_history = data.get("websocket", []) or data.get("ws_history", []) or []
        provider_history = data.get("providers", []) or data.get("provider_history", []) or []
        runtime_history = data.get("runtime", []) or data.get("runtime_history", []) or []

        failure_patterns = self.failure_detector.analyze(failures)
        recurring_collapses = self.collapse_detector.analyze(collapses)
        ws_anomalies = self.websocket_detector.detect_anomalies(ws_history)
        ws_desync = self.websocket_detector.find_desync_patterns(ws_history)
        ws_amplification = self.websocket_detector.detect_reconnect_amplification(ws_history)
        provider_reliability = self.provider_analyzer.analyze_reliability(provider_history)
        provider_correlations = self.provider_analyzer.find_correlated_failures(provider_history)
        runtime_decay = self.runtime_analyzer.analyze_decay_pattern(runtime_history)
        memory_leak = self.runtime_analyzer.detect_memory_leak_signature(runtime_history)
        fragility_conditions = self.runtime_analyzer.find_fragility_conditions(runtime_history)

        self.last_report = {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "failure_patterns": [p.to_dict() for p in failure_patterns],
            "common_chains": self.failure_detector.find_common_chains(failures),
            "precursors": self.failure_detector.detect_precursors(failures),
            "recurring_collapses": [p.to_dict() for p in recurring_collapses],
            "websocket": {
                "anomalies": ws_anomalies,
                "desync_patterns": ws_desync,
                "reconnect_amplification": ws_amplification,
            },
            "provider": {
                "reliability": provider_reliability,
                "correlated_failures": provider_correlations,
            },
            "runtime": {
                "decay_pattern": runtime_decay,
                "memory_leak": memory_leak,
                "fragility_conditions": fragility_conditions,
            },
        }
        self.last_report["top_risks"] = self.get_top_risks()
        self.last_report["recommendations"] = self.get_prevention_recommendations()
        return self.last_report

    def get_top_risks(self) -> list[dict]:
        """Return top 5 risks by confidence/severity inferred from last analysis."""
        risks: list[dict] = []
        for p in self.last_report.get("failure_patterns", []):
            risks.append({"risk": f"Recurring failure pattern: {p.get('pattern_type')}", "confidence": p.get("confidence", 0), "evidence": p})
        for p in self.last_report.get("recurring_collapses", []):
            confidence = min(0.95, 0.2 + p.get("recurrence_count", 0) * 0.1)
            risks.append({"risk": f"Recurring collapse: {p.get('collapse_type')}", "confidence": round(confidence, 3), "evidence": p})
        ws = self.last_report.get("websocket", {})
        amp = ws.get("reconnect_amplification", {})
        if amp.get("detected"):
            risks.append({"risk": "WebSocket reconnect amplification", "confidence": min(0.95, 0.5 + amp.get("amplification_factor", 0) / 10), "evidence": amp})
        if ws.get("desync_patterns"):
            risks.append({"risk": "Recurring WebSocket desync", "confidence": 0.75, "evidence": ws.get("desync_patterns")[:3]})
        runtime = self.last_report.get("runtime", {})
        if runtime.get("memory_leak", {}).get("detected"):
            risks.append({"risk": "Runtime memory leak signature", "confidence": runtime["memory_leak"].get("confidence", 0), "evidence": runtime["memory_leak"]})
        if runtime.get("decay_pattern", {}).get("decay_detected"):
            risks.append({"risk": "Runtime resource decay", "confidence": 0.65, "evidence": runtime["decay_pattern"]})
        provider = self.last_report.get("provider", {})
        if provider.get("reliability", {}).get("failure_rate", 0) > 10:
            risks.append({"risk": "Provider reliability degradation", "confidence": min(0.9, provider["reliability"]["failure_rate"] / 100 + 0.4), "evidence": provider["reliability"]})
        return sorted(risks, key=lambda x: x.get("confidence", 0), reverse=True)[:5]

    def get_prevention_recommendations(self) -> list[str]:
        """Generate actionable prevention recommendations from latest analysis."""
        recs: list[str] = []
        if self.last_report.get("common_chains"):
            chain = self.last_report["common_chains"][0].get("chain_str", "observed chain")
            recs.append(f"Add guardrails and circuit breakers around the top propagation chain: {chain}.")
        for p in self.last_report.get("recurring_collapses", [])[:3]:
            hint = p.get("prevention_hint")
            if hint:
                recs.append(hint)
        ws = self.last_report.get("websocket", {})
        if ws.get("reconnect_amplification", {}).get("detected"):
            recs.append("Implement exponential backoff with jitter and server-side reconnect throttling for WebSocket clients.")
        if ws.get("desync_patterns"):
            recs.append("Add sequence numbers, heartbeat validation, and state resync protocol for WebSocket channels.")
        provider = self.last_report.get("provider", {})
        if provider.get("reliability", {}).get("failure_rate", 0) > 0:
            recs.append("Enable provider fallback routing, request hedging limits, and per-provider circuit breakers.")
        runtime = self.last_report.get("runtime", {})
        if runtime.get("memory_leak", {}).get("detected"):
            recs.append("Capture heap snapshots during sustained runs and enforce memory growth budgets in CI.")
        if runtime.get("fragility_conditions"):
            recs.append("Create pre-failure alerts at the observed CPU, memory, and queue-depth fragility thresholds.")
        if not recs:
            recs.append("No dominant operational risk detected; continue collecting timeline and failure corpus data.")
        # Preserve order while deduplicating
        seen = set()
        unique = []
        for rec in recs:
            if rec not in seen:
                seen.add(rec)
                unique.append(rec)
        return unique

    def export_intelligence_report(self) -> str:
        """Export latest intelligence report as markdown."""
        if not self.last_report:
            return "# Operational Intelligence Report\n\nNo analysis has been run yet."
        lines = [
            "# Operational Intelligence Report",
            "",
            f"Generated at: {self.last_report.get('generated_at')}",
            "",
            "## Top Risks",
        ]
        for i, risk in enumerate(self.get_top_risks(), 1):
            lines.append(f"{i}. **{risk['risk']}** — confidence {risk.get('confidence', 0):.2f}")
        lines.extend(["", "## Recommendations"])
        for rec in self.get_prevention_recommendations():
            lines.append(f"- {rec}")
        lines.extend(["", "## Failure Patterns"])
        for p in self.last_report.get("failure_patterns", [])[:10]:
            lines.append(f"- {p.get('pattern_id')}: {p.get('pattern_type')} frequency={p.get('frequency')} confidence={p.get('confidence')}")
        lines.extend(["", "## Runtime Signals"])
        runtime = self.last_report.get("runtime", {})
        lines.append(f"- Decay: {runtime.get('decay_pattern', {})}")
        lines.append(f"- Memory leak: {runtime.get('memory_leak', {})}")
        return "\n".join(lines)
