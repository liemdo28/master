"""Self-Expanding Test Intelligence Division"""

from tester_qa.intelligence.recurring_failure import RecurringFailureDetector
from tester_qa.intelligence.flaky_detector import FlakyDetector
from tester_qa.intelligence.instability_predictor import InstabilityPredictor
from tester_qa.intelligence.pattern_learning import PatternLearner
from tester_qa.intelligence.architectural_weakness import ArchitecturalWeaknessDetector
from tester_qa.intelligence.regression_memory import RegressionMemory
from tester_qa.intelligence.coordinator import IntelligenceCoordinator, IntelligenceBriefing

__all__ = [
    "RecurringFailureDetector",
    "FlakyDetector",
    "InstabilityPredictor",
    "PatternLearner",
    "ArchitecturalWeaknessDetector",
    "RegressionMemory",
    "IntelligenceCoordinator",
    "IntelligenceBriefing",
]
