"""Collapse Predictor - Anticipates system collapse before it occurs."""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class CollapseEvent:
    """Represents a collapse event in the system."""
    timestamp: float
    severity: float
    affected_components: List[str] = field(default_factory=list)
    root_cause: Optional[str] = None
    precursor_signals: List[str] = field(default_factory=list)


@dataclass
class CollapsePrediction:
    """Prediction result for system collapse."""
    probability: float
    confidence: float
    timeline_minutes: float
    likely_affected: List[str] = field(default_factory=list)
    precursor_signals: List[str] = field(default_factory=list)
    recommendation: str = ""


@dataclass
class PrecursorSignal:
    """A signal that precedes a collapse."""
    name: str
    intensity: float
    detected_at: float
    correlation_to_collapse: float


class CollapsePredictor:
    """Predicts system collapse before it occurs using pattern analysis."""

    def __init__(self, threshold: float = 0.7):
        self.threshold = threshold
        self.precursor_history: List[PrecursorSignal] = []
        self.collapse_history: List[CollapseEvent] = []
        self.signal_weights: Dict[str, float] = {}
        self._calibration_data: Dict[str, List[float]] = {}

    def predict_collapse(
        self,
        current_metrics: Dict[str, float],
        historical_data: Optional[List[Dict[str, Any]]] = None
    ) -> CollapsePrediction:
        """
        Predict whether a collapse is imminent based on current metrics.
        
        Args:
            current_metrics: Dictionary of current system metrics
            historical_data: Optional historical data for context
            
        Returns:
            CollapsePrediction with probability and recommendations
        """
        probability = self.calculate_collapse_probability(current_metrics)
        confidence = self._calculate_confidence(current_metrics)
        timeline = self._estimate_collapse_timeline(probability, current_metrics)
        affected = self._identify_likely_affected(current_metrics)
        signals = self.identify_precursor_signals(current_metrics)
        
        recommendation = self._generate_recommendation(probability, signals)
        
        return CollapsePrediction(
            probability=probability,
            confidence=confidence,
            timeline_minutes=timeline,
            likely_affected=affected,
            precursor_signals=signals,
            recommendation=recommendation
        )

    def calculate_collapse_probability(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """
        Calculate the probability of system collapse.
        
        Args:
            metrics: Current system metrics
            
        Returns:
            Probability value between 0.0 and 1.0
        """
        if not metrics:
            return 0.0
        
        key_indicators = [
            'cpu_usage', 'memory_usage', 'error_rate', 
            'latency_p99', 'queue_depth', 'connection_count'
        ]
        
        weighted_sum = 0.0
        total_weight = 0.0
        
        for indicator in key_indicators:
            if indicator in metrics:
                value = metrics[indicator]
                normalized = self._normalize_indicator(indicator, value)
                weight = self.signal_weights.get(indicator, 1.0)
                weighted_sum += normalized * weight
                total_weight += weight
        
        if total_weight == 0:
            total_weight = len(key_indicators)
        
        probability = weighted_sum / total_weight
        
        cascade_score = self._calculate_cascade_score(metrics)
        probability = min(1.0, probability + cascade_score * 0.2)
        
        return round(probability, 4)

    def identify_precursor_signals(
        self,
        metrics: Dict[str, float]
    ) -> List[str]:
        """
        Identify precursor signals indicating imminent collapse.
        
        Args:
            metrics: Current system metrics
            
        Returns:
            List of detected precursor signal names
        """
        signals: List[str] = []
        current_time = 0.0
        
        if metrics.get('cpu_usage', 0) > 85:
            signals.append("HIGH_CPU_USAGE")
            self._record_precursor(
                "HIGH_CPU_USAGE", 0.85, current_time, 0.9
            )
        
        if metrics.get('memory_usage', 0) > 90:
            signals.append("MEMORY_PRESSURE")
            self._record_precursor(
                "MEMORY_PRESSURE", 0.9, current_time, 0.85
            )
        
        if metrics.get('error_rate', 0) > 0.05:
            signals.append("ELEVATED_ERROR_RATE")
            self._record_precursor(
                "ELEVATED_ERROR_RATE", 0.85, current_time, 0.8
            )
        
        if metrics.get('latency_p99', 0) > 1000:
            signals.append("LATENCY_DEGRADATION")
            self._record_precursor(
                "LATENCY_DEGRADATION", 0.75, current_time, 0.7
            )
        
        queue_depth = metrics.get('queue_depth', 0)
        if queue_depth > 5000:
            signals.append("QUEUE_OVERFLOW_RISK")
            self._record_precursor(
                "QUEUE_OVERFLOW_RISK", 0.8, current_time, 0.75
            )
        
        connection_ratio = metrics.get('connection_count', 0) / max(
            metrics.get('max_connections', 1000), 1
        )
        if connection_ratio > 0.8:
            signals.append("CONNECTION_EXHAUSTION")
            self._record_precursor(
                "CONNECTION_EXHAUSTION", 0.8, current_time, 0.7
            )
        
        return signals

    def _normalize_indicator(
        self,
        indicator: str,
        value: float
    ) -> float:
        """Normalize indicator values to 0-1 range."""
        thresholds = {
            'cpu_usage': 100.0,
            'memory_usage': 100.0,
            'error_rate': 1.0,
            'latency_p99': 5000.0,
            'queue_depth': 10000.0,
            'connection_count': 10000.0,
        }
        
        max_val = thresholds.get(indicator, 100.0)
        normalized = min(1.0, value / max_val)
        
        if indicator in ['error_rate', 'latency_p99']:
            normalized = normalized * 1.5
        
        return min(1.0, normalized)

    def _calculate_cascade_score(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate cascade failure score based on multiple metrics."""
        critical_count = 0
        total_metrics = 0
        
        critical_thresholds = {
            'cpu_usage': 90,
            'memory_usage': 95,
            'error_rate': 0.1,
            'latency_p99': 2000,
        }
        
        for metric, threshold in critical_thresholds.items():
            if metric in metrics:
                total_metrics += 1
                if metrics[metric] > threshold:
                    critical_count += 1
        
        if total_metrics == 0:
            return 0.0
        
        return critical_count / total_metrics

    def _calculate_confidence(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate confidence in the prediction."""
        known_metrics = len([
            m for m in ['cpu_usage', 'memory_usage', 'error_rate', 
                       'latency_p99', 'queue_depth', 'connection_count']
            if m in metrics
        ])
        
        coverage = known_metrics / 6.0
        
        history_weight = min(1.0, len(self.collapse_history) / 10.0)
        
        return round((coverage * 0.7 + history_weight * 0.3), 4)

    def _estimate_collapse_timeline(
        self,
        probability: float,
        metrics: Dict[str, float]
    ) -> float:
        """Estimate time until potential collapse in minutes."""
        if probability < 0.3:
            return 60.0
        
        if probability < 0.5:
            return 30.0
        
        if probability < 0.7:
            return 15.0
        
        if probability < 0.9:
            return 5.0
        
        return 2.0

    def _identify_likely_affected(
        self,
        metrics: Dict[str, float]
    ) -> List[str]:
        """Identify components likely to be affected by collapse."""
        affected: List[str] = []
        
        if metrics.get('cpu_usage', 0) > 80:
            affected.append("compute_cluster")
        
        if metrics.get('memory_usage', 0) > 85:
            affected.append("cache_layer")
        
        if metrics.get('queue_depth', 0) > 1000:
            affected.append("message_broker")
        
        if metrics.get('latency_p99', 0) > 500:
            affected.append("api_gateway")
        
        if metrics.get('connection_count', 0) > 5000:
            affected.append("load_balancer")
        
        return affected

    def _record_precursor(
        self,
        name: str,
        intensity: float,
        timestamp: float,
        correlation: float
    ) -> None:
        """Record a precursor signal for analysis."""
        signal = PrecursorSignal(
            name=name,
            intensity=intensity,
            detected_at=timestamp,
            correlation_to_collapse=correlation
        )
        self.precursor_history.append(signal)
        
        if len(self.precursor_history) > 1000:
            self.precursor_history = self.precursor_history[-500:]

    def _generate_recommendation(
        self,
        probability: float,
        signals: List[str]
    ) -> str:
        """Generate recommendation based on prediction."""
        if probability < 0.3:
            return "Continue monitoring. No immediate action required."
        
        if probability < 0.5:
            return f"Monitor closely. Detected signals: {', '.join(signals)}"
        
        if probability < 0.7:
            return "Consider scaling resources. Review error logs."
        
        if probability < 0.9:
            return "URGENT: Initiate failover procedures. Scale immediately."
        
        return "CRITICAL: Immediate intervention required. Activate disaster recovery."
