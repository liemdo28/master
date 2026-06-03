"""Weak Component Rank - Ranks components by failure risk and weakness."""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple


@dataclass
class ComponentRanking:
    """Ranking information for a component."""
    component_id: str
    rank: int
    failure_risk: float
    weakness_score: float
    risk_factors: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class DangerousComponent:
    """A component identified as dangerous (high failure risk)."""
    component_id: str
    danger_level: str
    probability_of_failure: float
    impact_on_system: float
    time_to_failure_minutes: Optional[float] = None


@dataclass
class FailureRiskAnalysis:
    """Complete failure risk analysis for a component."""
    component_id: str
    overall_risk: float
    risk_categories: Dict[str, float] = field(default_factory=list)
    historical_failure_rate: float = 0.0
    predicted_mtbf_hours: float = 0.0
    criticality: str = "MEDIUM"


class WeakComponentRank:
    """Ranks system components by weakness and failure risk."""

    def __init__(self):
        self.component_scores: Dict[str, Dict[str, float]] = {}
        self.rankings: List[ComponentRanking] = []
        self.dangerous_components: List[DangerousComponent] = []
        self.failure_history: Dict[str, List[Dict[str, Any]]] = {}
        self.risk_thresholds = {
            'critical': 0.9,
            'high': 0.7,
            'medium': 0.5,
            'low': 0.3
        }
        self._calibration_factors: Dict[str, float] = {}

    def rank_components(
        self,
        components: List[Dict[str, Any]],
        include_historical: bool = True
    ) -> List[ComponentRanking]:
        """
        Rank all components by their weakness and failure risk.
        
        Args:
            components: List of component dictionaries with metrics
            include_historical: Whether to factor in historical failure data
            
        Returns:
            List of ComponentRanking sorted by rank
        """
        self.rankings.clear()
        self.component_scores.clear()
        
        for component in components:
            comp_id = component.get('id', 'unknown')
            metrics = component.get('metrics', {})
            
            weakness_score = self._calculate_weakness_score(metrics)
            failure_risk = self._calculate_failure_risk(metrics, comp_id)
            risk_factors = self._identify_risk_factors(metrics)
            recommendations = self._generate_recommendations(weakness_score, risk_factors)
            
            self.component_scores[comp_id] = {
                'weakness_score': weakness_score,
                'failure_risk': failure_risk,
                'metrics': metrics
            }
            
            if include_historical and comp_id in self.failure_history:
                adjusted_risk = self._adjust_for_history(failure_risk, comp_id)
                self.component_scores[comp_id]['adjusted_risk'] = adjusted_risk
            
            ranking = ComponentRanking(
                component_id=comp_id,
                rank=0,
                failure_risk=failure_risk,
                weakness_score=weakness_score,
                risk_factors=risk_factors,
                recommendations=recommendations
            )
            
            self.rankings.append(ranking)
        
        self.rankings.sort(key=lambda r: r.failure_risk, reverse=True)
        
        for i, ranking in enumerate(self.rankings):
            ranking.rank = i + 1
        
        return self.rankings

    def identify_dangerous_components(
        self,
        components: List[Dict[str, Any]],
        threshold: float = 0.7
    ) -> List[DangerousComponent]:
        """
        Identify components that are dangerous (high failure risk).
        
        Args:
            components: List of component dictionaries
            threshold: Risk threshold for dangerous classification
            
        Returns:
            List of DangerousComponent sorted by probability of failure
        """
        self.dangerous_components.clear()
        
        for component in components:
            comp_id = component.get('id', 'unknown')
            metrics = component.get('metrics', {})
            
            failure_prob = self.calculate_failure_risk(comp_id, metrics)
            
            if failure_prob >= threshold:
                danger_level = self._classify_danger_level(failure_prob)
                impact = self._calculate_impact(comp_id, metrics)
                time_to_failure = self._estimate_time_to_failure(failure_prob, metrics)
                
                dangerous = DangerousComponent(
                    component_id=comp_id,
                    danger_level=danger_level,
                    probability_of_failure=failure_prob,
                    impact_on_system=impact,
                    time_to_failure_minutes=time_to_failure
                )
                
                self.dangerous_components.append(dangerous)
        
        self.dangerous_components.sort(
            key=lambda c: (c.probability_of_failure, c.impact_on_system),
            reverse=True
        )
        
        return self.dangerous_components

    def calculate_failure_risk(
        self,
        component_id: str,
        metrics: Optional[Dict[str, float]] = None
    ) -> float:
        """
        Calculate the failure risk for a specific component.
        
        Args:
            component_id: The component identifier
            metrics: Optional current metrics (uses stored if not provided)
            
        Returns:
            Failure risk score between 0.0 and 1.0
        """
        if metrics is None:
            if component_id in self.component_scores:
                metrics = self.component_scores[component_id].get('metrics', {})
            else:
                return 0.0
        
        risk_components: List[Tuple[str, float, float]] = [
            ('availability', self._calculate_availability_risk(metrics), 0.25),
            ('performance', self._calculate_performance_risk(metrics), 0.25),
            ('resource', self._calculate_resource_risk(metrics), 0.25),
            ('error', self._calculate_error_risk(metrics), 0.25),
        ]
        
        if component_id in self.failure_history:
            history_risk = self._calculate_historical_risk(component_id)
            risk_components.append(('history', history_risk, 0.0))
        
        weighted_risk = 0.0
        total_weight = 0.0
        
        for name, risk_value, weight in risk_components:
            if weight > 0:
                weighted_risk += risk_value * weight
                total_weight += weight
        
        if total_weight > 0:
            base_risk = weighted_risk / total_weight
        else:
            base_risk = 0.0
        
        if 'history' in [r[0] for r in risk_components]:
            history_risk = [r[1] for r in risk_components if r[0] == 'history'][0]
            base_risk = base_risk * 0.7 + history_risk * 0.3
        
        trend_factor = self._calculate_trend_factor(component_id, metrics)
        final_risk = min(1.0, base_risk * (1 + trend_factor * 0.2))
        
        return round(final_risk, 4)

    def _calculate_weakness_score(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate overall weakness score from metrics."""
        if not metrics:
            return 0.0
        
        weakness_indicators: List[float] = []
        
        if 'error_count' in metrics:
            weakness_indicators.append(min(1.0, metrics['error_count'] / 100))
        
        if 'retry_rate' in metrics:
            weakness_indicators.append(min(1.0, metrics['retry_rate']))
        
        if 'timeout_rate' in metrics:
            weakness_indicators.append(min(1.0, metrics['timeout_rate']))
        
        if 'degradation_score' in metrics:
            weakness_indicators.append(metrics['degradation_score'])
        
        if 'health_score' in metrics:
            weakness_indicators.append(1.0 - metrics['health_score'])
        
        if not weakness_indicators:
            return 0.0
        
        base_weakness = sum(weakness_indicators) / len(weakness_indicators)
        
        severe_count = len([w for w in weakness_indicators if w > 0.8])
        penalty = severe_count * 0.05
        
        return min(1.0, base_weakness + penalty)

    def _calculate_availability_risk(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate availability-related risk."""
        if 'uptime_percent' in metrics:
            downtime_risk = (100 - metrics['uptime_percent']) / 100
            return downtime_risk
        
        if 'availability_score' in metrics:
            return 1.0 - metrics['availability_score']
        
        return 0.0

    def _calculate_performance_risk(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate performance-related risk."""
        risk_factors: List[float] = []
        
        if 'latency_avg' in metrics:
            latency_risk = min(1.0, metrics['latency_avg'] / 2000)
            risk_factors.append(latency_risk)
        
        if 'throughput_degradation' in metrics:
            risk_factors.append(metrics['throughput_degradation'])
        
        if 'response_time_p99' in metrics:
            response_risk = min(1.0, metrics['response_time_p99'] / 5000)
            risk_factors.append(response_risk)
        
        if not risk_factors:
            return 0.0
        
        return max(risk_factors)

    def _calculate_resource_risk(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate resource-related risk."""
        risk_factors: List[float] = []
        
        if 'cpu_usage' in metrics:
            risk_factors.append(metrics['cpu_usage'] / 100)
        
        if 'memory_usage' in metrics:
            risk_factors.append(metrics['memory_usage'] / 100)
        
        if 'disk_usage' in metrics:
            risk_factors.append(metrics['disk_usage'] / 100)
        
        if 'network_utilization' in metrics:
            risk_factors.append(metrics['network_utilization'] / 100)
        
        if not risk_factors:
            return 0.0
        
        avg_risk = sum(risk_factors) / len(risk_factors)
        
        max_risk = max(risk_factors)
        
        return avg_risk * 0.5 + max_risk * 0.5

    def _calculate_error_risk(
        self,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate error-related risk."""
        risk_factors: List[float] = []
        
        if 'error_rate' in metrics:
            risk_factors.append(min(1.0, metrics['error_rate'] * 100))
        
        if 'failure_count' in metrics:
            risk_factors.append(min(1.0, metrics['failure_count'] / 50))
        
        if 'exception_rate' in metrics:
            risk_factors.append(min(1.0, metrics['exception_rate']))
        
        if not risk_factors:
            return 0.0
        
        return max(risk_factors)

    def _calculate_historical_risk(
        self,
        component_id: str
    ) -> float:
        """Calculate risk based on historical failure data."""
        if component_id not in self.failure_history:
            return 0.0
        
        history = self.failure_history[component_id]
        
        if not history:
            return 0.0
        
        recent_failures = [
            f for f in history
            if f.get('timestamp', 0) > 0
        ]
        
        if not recent_failures:
            return 0.0
        
        failure_rate = len(recent_failures) / max(len(history), 1)
        
        avg_severity = sum(
            f.get('severity', 0) for f in recent_failures
        ) / len(recent_failures)
        
        return min(1.0, failure_rate * 0.5 + avg_severity * 0.5)

    def _identify_risk_factors(
        self,
        metrics: Dict[str, float]
    ) -> List[str]:
        """Identify specific risk factors from metrics."""
        factors: List[str] = []
        
        if metrics.get('error_rate', 0) > 0.05:
            factors.append("high_error_rate")
        
        if metrics.get('cpu_usage', 0) > 85:
            factors.append("cpu_saturation")
        
        if metrics.get('memory_usage', 0) > 90:
            factors.append("memory_exhaustion")
        
        if metrics.get('latency_avg', 0) > 1000:
            factors.append("latency_degradation")
        
        if metrics.get('retry_rate', 0) > 0.1:
            factors.append("elevated_retries")
        
        if metrics.get('timeout_rate', 0) > 0.05:
            factors.append("timeout_issues")
        
        if metrics.get('throughput_degradation', 0) > 0.2:
            factors.append("throughput_decline")
        
        return factors

    def _generate_recommendations(
        self,
        weakness_score: float,
        risk_factors: List[str]
    ) -> List[str]:
        """Generate recommendations based on weakness and risk factors."""
        recommendations: List[str] = []
        
        if weakness_score > 0.8:
            recommendations.append("IMMEDIATE: Component requires urgent attention")
        
        if 'cpu_saturation' in risk_factors:
            recommendations.append("Consider scaling or offloading compute")
        
        if 'memory_exhaustion' in risk_factors:
            recommendations.append("Review memory leaks or increase capacity")
        
        if 'high_error_rate' in risk_factors:
            recommendations.append("Investigate root cause of errors")
        
        if 'latency_degradation' in risk_factors:
            recommendations.append("Optimize query patterns or add caching")
        
        if 'elevated_retries' in risk_factors:
            recommendations.append("Check dependency health and circuit breakers")
        
        if not recommendations:
            recommendations.append("Continue monitoring")
        
        return recommendations

    def _classify_danger_level(
        self,
        failure_prob: float
    ) -> str:
        """Classify the danger level based on failure probability."""
        if failure_prob >= self.risk_thresholds['critical']:
            return "CRITICAL"
        elif failure_prob >= self.risk_thresholds['high']:
            return "HIGH"
        elif failure_prob >= self.risk_thresholds['medium']:
            return "MEDIUM"
        else:
            return "LOW"

    def _calculate_impact(
        self,
        component_id: str,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate impact on system if this component fails."""
        base_impact = 0.5
        
        if metrics.get('is_critical', False):
            base_impact = 0.9
        
        if metrics.get('is_shared', False):
            base_impact = base_impact * 1.2
        
        user_impact = metrics.get('user_impact_score', 0.5)
        
        return min(1.0, base_impact * 0.5 + user_impact * 0.5)

    def _estimate_time_to_failure(
        self,
        failure_prob: float,
        metrics: Dict[str, float]
    ) -> Optional[float]:
        """Estimate time to failure in minutes."""
        if failure_prob < 0.5:
            return None
        
        base_time = 60.0
        
        if failure_prob >= 0.9:
            return 5.0
        
        if failure_prob >= 0.8:
            return 15.0
        
        if failure_prob >= 0.7:
            return 30.0
        
        return base_time

    def _adjust_for_history(
        self,
        current_risk: float,
        component_id: str
    ) -> float:
        """Adjust risk calculation based on historical failures."""
        if component_id not in self.failure_history:
            return current_risk
        
        history = self.failure_history[component_id]
        
        if not history:
            return current_risk
        
        recent_failures = len([f for f in history if f.get('recent', False)])
        
        if recent_failures > 3:
            return min(1.0, current_risk * 1.5)
        
        if recent_failures > 0:
            return min(1.0, current_risk * 1.2)
        
        return current_risk

    def _calculate_trend_factor(
        self,
        component_id: str,
        metrics: Dict[str, float]
    ) -> float:
        """Calculate trend factor for risk prediction."""
        if component_id not in self.component_scores:
            return 0.0
        
        previous_scores = self.component_scores[component_id]
        
        if 'failure_risk' not in previous_scores:
            return 0.0
        
        previous_risk = previous_scores['failure_risk']
        current_risk = self.calculate_failure_risk(component_id, metrics)
        
        if current_risk > previous_risk:
            return min(1.0, (current_risk - previous_risk) * 5)
        
        return 0.0
