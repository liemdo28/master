"""Dependency Risk Analyzer — Audit package.json and dependency vulnerabilities."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Known vulnerable packages (simplified; real implementation would use OSV database)
VULNERABLE_PACKAGES = {
    "event-stream": "<3.3.6",
    "flatmap-stream": "<0.1.1",
    "lodash": "<4.17.21",
    "minimist": "<1.2.6",
    "node-uuid": "any (deprecated)",
    "request": "any (deprecated)",
    "moment": "<2.29.4",
    "axios": "<1.6.0",
    "follow-redirects": "<1.14.8",
    "shelljs": "<0.8.5",
    "jsonwebtoken": "<9.0.0",
    "jwt-decode": "<3.1.2",
    "sanitize-html": "<2.3.2",
    "marked": "<4.0.10",
    "word-wrap": "<1.2.4",
    "nth-check": "<2.0.1",
    "postcss": "<8.4.31",
    "semver": "<7.5.2",
    "tar": "<6.1.11",
    "glob-parent": "<5.1.2",
    "serialize-javascript": "<3.1.0",
    "node-fetch": "<2.6.7",
    "yaml": "<2.2.2",
    "immer": "<9.0.21",
    "ua-parser-js": "<1.0.33",
    "js-yaml": "<6.0.0",
    "ssri": "<8.0.1",
    "path-parse": "<1.0.7",
    "trim-newlines": "<3.0.1",
}

DEAD_PACKAGES = {
    "request", "node-uuid", "mkdirp", "rimraf", "colors",
    "left-pad", "isarray", "component-emitter", "sax",
    "http-parser-js", "fstream", "boom", "hoek", "cryptiles",
}


@dataclass
class DependencyRiskFinding:
    package: str
    version: str
    severity: str
    issue: str
    cve: str | None
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "package": self.package,
            "version": self.version,
            "severity": self.severity,
            "issue": self.issue,
            "cve": self.cve,
            "recommendation": self.recommendation,
        }


@dataclass
class DependencyReport:
    total_deps: int
    dev_deps: int
    prod_deps: int
    dead_packages: list[str]
    vulnerable_packages: list[DependencyRiskFinding]
    outdated_critical: list[str]
    license_risks: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_dependencies": self.total_deps,
            "dev_dependencies": self.dev_deps,
            "prod_dependencies": self.prod_deps,
            "dead_packages": self.dead_packages,
            "vulnerable_packages": [f.to_dict() for f in self.vulnerable_packages],
            "outdated_critical": self.outdated_critical,
            "license_risks": self.license_risks,
            "risk_score": len(self.vulnerable_packages) * 10 + len(self.dead_packages) * 5,
        }


class DependencyRiskAnalyzer:
    """Analyze package.json for dependency risks."""

    def analyze_package_json(self, pkg_path: Path | str) -> list[DependencyRiskFinding]:
        findings = []
        path = Path(pkg_path)
        if not path.exists():
            return findings

        try:
            pkg = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return findings

        all_deps = {}
        all_deps.update(pkg.get("dependencies", {}))
        all_deps.update(pkg.get("devDependencies", {}))
        all_deps.update(pkg.get("peerDependencies", {}))
        all_deps.update(pkg.get("optionalDependencies", {}))

        for name, version_spec in all_deps.items():
            if name in DEAD_PACKAGES:
                findings.append(DependencyRiskFinding(
                    package=name,
                    version=version_spec,
                    severity="critical",
                    issue=f"Dead/deprecated package: {name}",
                    cve=None,
                    recommendation=f"Replace {name} with maintained alternative",
                ))
                continue

            if name in VULNERABLE_PACKAGES:
                findings.append(DependencyRiskFinding(
                    package=name,
                    version=version_spec,
                    severity="high",
                    issue=f"Known vulnerability pattern: {name} {VULNERABLE_PACKAGES[name]}",
                    cve=None,
                    recommendation=f"Upgrade {name} beyond {VULNERABLE_PACKAGES[name]}",
                ))

            if version_spec.startswith("git://") or version_spec.startswith("http://"):
                findings.append(DependencyRiskFinding(
                    package=name,
                    version=version_spec,
                    severity="high",
                    issue="Dependency loaded over insecure protocol",
                    cve=None,
                    recommendation="Use HTTPS or npm registry for dependency URLs",
                ))

            if version_spec == "*" or version_spec.startswith("github:"):
                findings.append(DependencyRiskFinding(
                    package=name,
                    version=version_spec,
                    severity="medium",
                    issue="Unpinned or floating version constraint",
                    cve=None,
                    recommendation="Pin to exact version or use locked minor/patch range",
                ))

        return findings
