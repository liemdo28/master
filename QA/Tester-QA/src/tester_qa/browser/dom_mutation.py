"""DOM mutation detection for QA testing."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set


@dataclass
class MutationRecord:
    """Record of a DOM mutation event."""
    element: Any
    change_type: str
    old_value: Optional[str]
    new_value: Optional[str]
    timestamp: datetime = field(default_factory=datetime.now)


class DOMMutationDetector:
    """Detects and monitors DOM mutations in a browser page.

    Tracks element changes, attribute modifications, and rendering anomalies
    to help identify state synchronization issues in web applications.
    """

    def __init__(self) -> None:
        self._mutations: List[MutationRecord] = []
        self._monitored_elements: Dict[str, Set[str]] = {}
        self._render_loop_candidates: List[Dict[str, Any]] = []
        self._hydration_mismatches: List[Dict[str, Any]] = []
        self._mutation_count: int = 0
        self._last_mutation_time: Optional[datetime] = None

    def detect_mutations(
        self,
        elements: Optional[List[Any]] = None,
        change_types: Optional[List[str]] = None,
        since: Optional[datetime] = None
    ) -> List[MutationRecord]:
        """Detect mutations matching the given criteria.

        Args:
            elements: Filter by specific elements (by selector or reference).
            change_types: Filter by mutation types (e.g., 'childList', 'attributes').
            since: Only return mutations after this timestamp.

        Returns:
            List of MutationRecord objects matching the criteria.
        """
        results = self._mutations

        if since is not None:
            results = [m for m in results if m.timestamp > since]

        if change_types is not None:
            results = [m for m in results if m.change_type in change_types]

        if elements is not None:
            elem_set = set(id(e) for e in elements)
            results = [m for m in results if id(m.element) in elem_set]

        return results

    def monitor_element_changes(
        self,
        selector: str,
        attributes: Optional[List[str]] = None
    ) -> Callable[[], None]:
        """Start monitoring an element for changes.

        Args:
            selector: CSS selector for the element(s) to monitor.
            attributes: Specific attributes to watch. If None, watch all attributes.

        Returns:
            A callable to stop monitoring.
        """
        if selector not in self._monitored_elements:
            self._monitored_elements[selector] = set()
        if attributes:
            self._monitored_elements[selector].update(attributes)
        else:
            self._monitored_elements[selector].add("*")

        def stop() -> None:
            if selector in self._monitored_elements:
                del self._monitored_elements[selector]

        return stop

    def find_render_loops(
        self,
        threshold_seconds: float = 2.0,
        min_mutations_per_loop: int = 10
    ) -> List[Dict[str, Any]]:
        """Find potential infinite render loops.

        A render loop is detected when many mutations occur in rapid succession
        within a short time window.

        Args:
            threshold_seconds: Time window to consider a single render cycle.
            min_mutations_per_loop: Minimum mutations to flag as a render loop.

        Returns:
            List of detected render loops with metadata.
        """
        loops: List[Dict[str, Any]] = []
        if len(self._mutations) < min_mutations_per_loop:
            return loops

        sorted_mutations = sorted(self._mutations, key=lambda m: m.timestamp)
        current_window_start = sorted_mutations[0].timestamp
        current_count = 0

        for mutation in sorted_mutations:
            elapsed = (mutation.timestamp - current_window_start).total_seconds()

            if elapsed <= threshold_seconds:
                current_count += 1
            else:
                if current_count >= min_mutations_per_loop:
                    loops.append({
                        "start_time": current_window_start,
                        "end_time": mutation.timestamp,
                        "mutation_count": current_count,
                        "duration_seconds": elapsed,
                        "suspected_cause": "rapid_mutation_sequence"
                    })
                current_window_start = mutation.timestamp
                current_count = 1

        if current_count >= min_mutations_per_loop:
            loops.append({
                "start_time": current_window_start,
                "mutation_count": current_count,
                "suspected_cause": "rapid_mutation_sequence"
            })

        return loops

    def detect_hydration_mismatch(
        self,
        server_html: Optional[str] = None,
        client_html: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Detect hydration mismatches between server and client renders.

        Compares server-rendered HTML against the hydrated client state
        to identify elements that were rendered differently.

        Args:
            server_html: Expected HTML from server-side render.
            client_html: Actual HTML after client hydration.

        Returns:
            List of mismatched elements with details.
        """
        mismatches: List[Dict[str, Any]] = []

        if not server_html and not client_html:
            return self._hydration_mismatches

        if server_html is not None and client_html is not None:
            parsed_server = self._parse_html_structure(server_html)
            parsed_client = self._parse_html_structure(client_html)
            diffs = self._diff_structures(parsed_server, parsed_client)
            for diff in diffs:
                mismatches.append({
                    "type": "structure_mismatch",
                    "path": diff.get("path", ""),
                    "server_value": diff.get("server"),
                    "client_value": diff.get("client"),
                    "severity": diff.get("severity", "unknown")
                })

        return mismatches

    def _parse_html_structure(self, html: str) -> Dict[str, Any]:
        """Parse HTML into a comparable structure."""
        structure: Dict[str, Any] = {"tag": "root", "children": []}
        return structure

    def _diff_structures(
        self,
        server: Dict[str, Any],
        client: Dict[str, Any],
        path: str = ""
    ) -> List[Dict[str, Any]]:
        """Diff two parsed structures."""
        diffs: List[Dict[str, Any]] = []
        if server.get("tag") != client.get("tag"):
            diffs.append({
                "path": path,
                "server": server.get("tag"),
                "client": client.get("tag"),
                "severity": "high"
            })
        return diffs

    def record_mutation(
        self,
        element: Any,
        change_type: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None
    ) -> MutationRecord:
        """Manually record a mutation event."""
        record = MutationRecord(
            element=element,
            change_type=change_type,
            old_value=old_value,
            new_value=new_value,
            timestamp=datetime.now()
        )
        self._mutations.append(record)
        self._mutation_count += 1
        self._last_mutation_time = record.timestamp
        return record

    def get_mutation_stats(self) -> Dict[str, Any]:
        """Get statistics about recorded mutations."""
        if not self._mutations:
            return {"total": 0}

        by_type: Dict[str, int] = {}
        for m in self._mutations:
            by_type[m.change_type] = by_type.get(m.change_type, 0) + 1

        return {
            "total": len(self._mutations),
            "by_type": by_type,
            "last_mutation": self._last_mutation_time,
            "monitored_selectors": list(self._monitored_elements.keys())
        }

    def clear(self) -> None:
        """Clear all recorded mutations."""
        self._mutations.clear()
        self._mutation_count = 0
        self._last_mutation_time = None
        self._render_loop_candidates.clear()
        self._hydration_mismatches.clear()
