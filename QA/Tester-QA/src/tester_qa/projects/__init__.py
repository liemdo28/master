"""Multi-project discovery, indexing, and registry."""
from tester_qa.projects.scanner import MultiProjectScanner, ProjectInfo
from tester_qa.projects.monorepo_detector import MonorepoDetector, MonorepoInfo
from tester_qa.projects.framework_detector import FrameworkDetector, FrameworkProfile
from tester_qa.projects.runtime_locator import RuntimeLocator, RuntimeInstance
from tester_qa.projects.project_indexer import ProjectIndexer
from tester_qa.projects.registry import ProjectRegistry, ProjectRecord
from tester_qa.projects.analyzer import ProjectAnalyzer
from tester_qa.projects.dependency_map import dependency_map
from tester_qa.projects.healthcheck import ProjectHealthcheck
from tester_qa.projects.risk_map import assess_project_risk, build_risk_map

__all__ = [
    "MultiProjectScanner",
    "ProjectInfo",
    "MonorepoDetector",
    "MonorepoInfo",
    "FrameworkDetector",
    "FrameworkProfile",
    "RuntimeLocator",
    "RuntimeInstance",
    "ProjectIndexer",
    "ProjectRegistry",
    "ProjectRecord",
    "ProjectAnalyzer",
    "ProjectHealthcheck",
    "assess_project_risk",
    "build_risk_map",
    "dependency_map",
]
