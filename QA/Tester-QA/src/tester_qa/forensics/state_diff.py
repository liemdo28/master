"""State Diff Module - Compares system states before/after failures."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ChangeType(Enum):
    """Types of state changes."""
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"


class ImpactLevel(Enum):
    """Impact levels for state changes."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


@dataclass
class StateChange:
    """A single state change between two points in time."""
    path: str
    change_type: ChangeType
    before_value: Optional[Any] = None
    after_value: Optional[Any] = None
    impact: ImpactLevel = ImpactLevel.NONE
    description: Optional[str] = None
    category: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Export change as dictionary."""
        return {
            "path": self.path,
            "change_type": self.change_type.value,
            "before_value": str(self.before_value) if self.before_value is not None else None,
            "after_value": str(self.after_value) if self.after_value is not None else None,
            "impact": self.impact.value,
            "description": self.description,
            "category": self.category,
        }


@dataclass
class StateDiffResult:
    """Complete result of a state comparison."""
    diff_id: str
    timestamp: datetime
    before_label: str
    after_label: str
    changes: List[StateChange]
    total_changes: int
    impact_summary: Dict[str, int]
    categories: Dict[str, List[StateChange]]
    overall_impact: ImpactLevel

    def to_dict(self) -> Dict[str, Any]:
        """Export diff result as dictionary."""
        return {
            "diff_id": self.diff_id,
            "timestamp": self.timestamp.isoformat(),
            "before_label": self.before_label,
            "after_label": self.after_label,
            "changes": [c.to_dict() for c in self.changes],
            "total_changes": self.total_changes,
            "impact_summary": self.impact_summary,
            "categories": {k: [c.to_dict() for c in v] for k, v in self.categories.items()},
            "overall_impact": self.overall_impact.value,
        }


class StateDiff:
    """Compares system states before and after failures."""

    def __init__(self) -> None:
        self._diff_history: List[StateDiffResult] = []
        self._impact_rules: Dict[str, ImpactLevel] = {
            "database": ImpactLevel.CRITICAL,
            "authentication": ImpactLevel.CRITICAL,
            "network": ImpactLevel.HIGH,
            "memory": ImpactLevel.HIGH,
            "cpu": ImpactLevel.MEDIUM,
            "disk": ImpactLevel.MEDIUM,
            "process": ImpactLevel.MEDIUM,
            "config": ImpactLevel.HIGH,
            "connection": ImpactLevel.HIGH,
            "environment": ImpactLevel.LOW,
        }

    def diff_states(
        self,
        before_state: Dict[str, Any],
        after_state: Dict[str, Any],
        before_label: str = "before",
        after_label: str = "after",
        category_hints: Optional[Dict[str, str]] = None,
    ) -> StateDiffResult:
        """Compare two states and produce a detailed diff.

        Args:
            before_state: State before the incident.
            after_state: State after the incident.
            before_label: Label for the before state (e.g., timestamp).
            after_label: Label for the after state.
            category_hints: Optional hints for categorizing paths.

        Returns:
            StateDiffResult with all identified changes.
        """
        changes: List[StateChange] = []
        self._flatten_and_compare("", before_state, after_state, changes)

        for change in changes:
            change.impact = self._determine_impact(change.path, change.change_type)
            change.category = self._categorize(change.path, category_hints)

        impact_summary: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0, "none": 0}
        for change in changes:
            impact_summary[change.impact.value] += 1

        categories: Dict[str, List[StateChange]] = {}
        for change in changes:
            cat = change.category or "other"
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(change)

        overall_impact = self._compute_overall_impact(impact_summary)

        result = StateDiffResult(
            diff_id=f"diff-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            timestamp=datetime.utcnow(),
            before_label=before_label,
            after_label=after_label,
            changes=changes,
            total_changes=len(changes),
            impact_summary=impact_summary,
            categories=categories,
            overall_impact=overall_impact,
        )

        self._diff_history.append(result)
        return result

    def identify_changes(
        self,
        diff_result: StateDiffResult,
        min_impact: ImpactLevel = ImpactLevel.LOW,
    ) -> List[StateChange]:
        """Identify changes filtered by minimum impact level.

        Args:
            diff_result: The diff result to filter.
            min_impact: Minimum impact level to include.

        Returns:
            List of changes meeting the impact threshold.
        """
        impact_order = [ImpactLevel.NONE, ImpactLevel.LOW, ImpactLevel.MEDIUM, ImpactLevel.HIGH, ImpactLevel.CRITICAL]
        try:
            min_idx = impact_order.index(min_impact)
        except ValueError:
            min_idx = 0

        return [
            c for c in diff_result.changes
            if c.change_type != ChangeType.UNCHANGED
            and impact_order.index(c.impact) >= min_idx
        ]

    def calculate_impact(
        self,
        changes: List[StateChange],
    ) -> Dict[str, Any]:
        """Calculate overall impact score from a list of changes.

        Args:
            changes: List of state changes to analyze.

        Returns:
            Dictionary with impact analysis.
        """
        total = len(changes)
        if total == 0:
            return {"score": 0, "level": ImpactLevel.NONE.value, "summary": "No changes"}

        weighted_score = 0
        weights = {
            ImpactLevel.CRITICAL: 10,
            ImpactLevel.HIGH: 5,
            ImpactLevel.MEDIUM: 2,
            ImpactLevel.LOW: 1,
            ImpactLevel.NONE: 0,
        }

        for change in changes:
            weighted_score += weights.get(change.impact, 0)

        max_possible = total * 10
        normalized_score = (weighted_score / max_possible) * 100 if max_possible > 0 else 0

        if normalized_score >= 70:
            level = ImpactLevel.CRITICAL
        elif normalized_score >= 40:
            level = ImpactLevel.HIGH
        elif normalized_score >= 20:
            level = ImpactLevel.MEDIUM
        elif normalized_score > 0:
            level = ImpactLevel.LOW
        else:
            level = ImpactLevel.NONE

        by_type: Dict[str, int] = {}
        for change in changes:
            ct = change.change_type.value
            by_type[ct] = by_type.get(ct, 0) + 1

        return {
            "score": round(normalized_score, 2),
            "level": level.value,
            "weighted_score": weighted_score,
            "total_changes": total,
            "changes_by_type": by_type,
            "critical_count": len([c for c in changes if c.impact == ImpactLevel.CRITICAL]),
            "high_count": len([c for c in changes if c.impact == ImpactLevel.HIGH]),
        }

    def get_diff_history(self) -> List[StateDiffResult]:
        """Return all historical diff results."""
        return self._diff_history

    def export_diff(self, diff: StateDiffResult, format: str = "dict") -> Any:
        """Export a diff result in the specified format.

        Args:
            diff: The StateDiffResult to export.
            format: Output format - dict, text, or json.

        Returns:
            Formatted diff data.
        """
        if format == "text":
            return self._format_diff_text(diff)
        elif format == "json":
            import json
            return json.dumps(diff.to_dict(), indent=2, default=str)
        return diff.to_dict()

    def _flatten_and_compare(
        self,
        prefix: str,
        before: Any,
        after: Any,
        changes: List[StateChange],
    ) -> None:
        """Recursively flatten nested dicts and compare."""
        if isinstance(before, dict) and isinstance(after, dict):
            all_keys = set(before.keys()) | set(after.keys())
            for key in all_keys:
                path = f"{prefix}.{key}" if prefix else key
                if key not in before:
                    changes.append(StateChange(
                        path=path,
                        change_type=ChangeType.ADDED,
                        before_value=None,
                        after_value=after[key],
                    ))
                elif key not in after:
                    changes.append(StateChange(
                        path=path,
                        change_type=ChangeType.REMOVED,
                        before_value=before[key],
                        after_value=None,
                    ))
                else:
                    self._flatten_and_compare(path, before[key], after[key], changes)
        elif isinstance(before, list) and isinstance(after, list):
            if len(before) != len(after):
                changes.append(StateChange(
                    path=prefix,
                    change_type=ChangeType.MODIFIED,
                    before_value=before,
                    after_value=after,
                    description=f"List length changed from {len(before)} to {len(after)}",
                ))
            else:
                for i, (b, a) in enumerate(zip(before, after)):
                    self._flatten_and_compare(f"{prefix}[{i}]", b, a, changes)
        else:
            if before != after:
                changes.append(StateChange(
                    path=prefix,
                    change_type=ChangeType.MODIFIED,
                    before_value=before,
                    after_value=after,
                ))

    def _determine_impact(self, path: str, change_type: ChangeType) -> ImpactLevel:
        """Determine the impact level of a change."""
        if change_type == ChangeType.UNCHANGED:
            return ImpactLevel.NONE

        path_lower = path.lower()
        for key, level in self._impact_rules.items():
            if key in path_lower:
                return level

        return ImpactLevel.LOW

    def _categorize(self, path: str, hints: Optional[Dict[str, str]] = None) -> str:
        """Categorize a change based on its path."""
        path_lower = path.lower()

        if hints:
            for pattern, category in hints.items():
                if pattern.lower() in path_lower:
                    return category

        category_map = {
            "database": "database",
            "db": "database",
            "sql": "database",
            "auth": "authentication",
            "credential": "authentication",
            "token": "authentication",
            "memory": "memory",
            "heap": "memory",
            "cpu": "cpu",
            "process": "process",
            "proc": "process",
            "connection": "connection",
            "socket": "connection",
            "network": "network",
            "http": "network",
            "config": "config",
            "environment": "environment",
            "env": "environment",
            "disk": "disk",
            "file": "filesystem",
        }

        for key, category in category_map.items():
            if key in path_lower:
                return category

        return "other"

    def _compute_overall_impact(self, summary: Dict[str, int]) -> ImpactLevel:
        """Compute overall impact from summary counts."""
        if summary.get("critical", 0) > 0:
            return ImpactLevel.CRITICAL
        if summary.get("high", 0) >= 3:
            return ImpactLevel.CRITICAL
        if summary.get("high", 0) > 0:
            return ImpactLevel.HIGH
        if summary.get("medium", 0) >= 3:
            return ImpactLevel.HIGH
        if summary.get("medium", 0) > 0:
            return ImpactLevel.MEDIUM
        if summary.get("low", 0) > 0:
            return ImpactLevel.LOW
        return ImpactLevel.NONE

    def _format_diff_text(self, diff: StateDiffResult) -> str:
        """Format diff as human-readable text."""
        lines = [
            "=" * 60,
            "STATE DIFF REPORT",
            "=" * 60,
            f"Diff ID:       {diff.diff_id}",
            f"Timestamp:     {diff.timestamp.isoformat()}",
            f"Before:        {diff.before_label}",
            f"After:         {diff.after_label}",
            f"Total Changes: {diff.total_changes}",
            f"Overall Impact: {diff.overall_impact.value.upper()}",
            "",
            "IMPACT SUMMARY:",
            f"  Critical: {diff.impact_summary.get("critical", 0)}",
            f"  High:     {diff.impact_summary.get("high", 0)}",
            f"  Medium:   {diff.impact_summary.get("medium", 0)}",
            f"  Low:      {diff.impact_summary.get("low", 0)}",
            "",
            "CHANGES:",
        ]

        for change in diff.changes:
            if change.change_type == ChangeType.UNCHANGED:
                continue
            lines.append(
                f"  [{change.change_type.value.upper()}] [{change.impact.value.upper()}] {change.path}"
            )
            if change.before_value is not None:
                lines.append(f"    Before: {change.before_value}")
            if change.after_value is not None:
                lines.append(f"    After:  {change.after_value}")
            if change.description:
                lines.append(f"    Note:   {change.description}")

        lines.append("=" * 60)
        return "\n".join(lines)
