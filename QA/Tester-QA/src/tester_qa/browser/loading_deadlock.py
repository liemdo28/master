"""Loading deadlock and UI freeze detection for QA testing."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set


@dataclass
class DeadlockReport:
    """Report of a detected deadlock or freeze condition."""
    detected_at: datetime = field(default_factory=datetime.now)
    freeze_duration_seconds: float = 0.0
    frozen_elements: List[str] = field(default_factory=list)
    pending_requests: List[str] = field(default_factory=list)
    cause: str = ""
    severity: str = "unknown"


@dataclass
class PendingRequest:
    """Represents a network request that may be stalled."""
    url: str
    method: str
    started_at: datetime
    status: str = "pending"
    response_received: bool = False


class LoadingDeadlockDetector:
    """Detects loading deadlocks, infinite loaders, and UI freezes.

    Monitors for situations where the UI becomes unresponsive due to
    unresolved network requests, stuck loading states, or circular
    dependency chains.
    """

    def __init__(self, freeze_threshold_seconds: float = 5.0) -> None:
        self._freeze_threshold = freeze_threshold_seconds
        self._loaders: Dict[str, Dict[str, Any]] = {}
        self._pending_requests: Dict[str, PendingRequest] = {}
        self._ui_states: Dict[str, str] = {}
        self._freeze_detections: List[DeadlockReport] = []
        self._last_ui_update: Optional[datetime] = None
        self._observed_freeze: bool = False

    def detect_infinite_loaders(
        self,
        loader_selectors: List[str],
        expected_resolve_seconds: float = 10.0
    ) -> List[Dict[str, Any]]:
        """Detect loaders that have been active beyond expected duration.

        Args:
            loader_selectors: CSS selectors for loading indicators.
            expected_resolve_seconds: Maximum time before a loader should resolve.

        Returns:
            List of infinite loader detections with metadata.
        """
        infinite_loaders: List[Dict[str, Any]] = []
        now = datetime.now()

        for selector in loader_selectors:
            loader_info = self._loaders.get(selector)
            if loader_info is None:
                self._loaders[selector] = {
                    "started_at": now,
                    "state": "active",
                    "resolved": False
                }
                continue

            started_at = loader_info.get("started_at", now)
            duration = (now - started_at).total_seconds()

            if duration > expected_resolve_seconds and not loader_info.get("resolved"):
                infinite_loaders.append({
                    "selector": selector,
                    "state": loader_info.get("state", "unknown"),
                    "active_duration_seconds": duration,
                    "started_at": started_at,
                    "severity": "critical" if duration > expected_resolve_seconds * 2 else "warning"
                })

        return infinite_loaders

    def find_ui_freeze(
        self,
        ui_elements: List[Any],
        frame_timestamps: Optional[List[datetime]] = None
    ) -> Optional[DeadlockReport]:
        """Find UI freezes where elements become unresponsive.

        Args:
            ui_elements: Elements to monitor for responsiveness.
            frame_timestamps: Optional list of animation frame timestamps.

        Returns:
            DeadlockReport if a freeze is detected, None otherwise.
        """
        now = datetime.now()

        if self._last_ui_update is None:
            self._last_ui_update = now
            return None

        time_since_update = (now - self._last_ui_update).total_seconds()

        if frame_timestamps and len(frame_timestamps) >= 2:
            frame_gaps = [
                (frame_timestamps[i + 1] - frame_timestamps[i]).total_seconds()
                for i in range(len(frame_timestamps) - 1)
            ]
            max_gap = max(frame_gaps) if frame_gaps else 0.0
            if max_gap > self._freeze_threshold:
                return self._create_freeze_report(
                    duration_seconds=max_gap,
                    frozen_selectors=self._get_element_selectors(ui_elements),
                    cause="animation_frame_stall"
                )

        if time_since_update > self._freeze_threshold:
            frozen_selectors = []
            for element in ui_elements:
                selector = self._get_element_selector(element)
                frozen_selectors.append(selector)

            report = self._create_freeze_report(
                duration_seconds=time_since_update,
                frozen_selectors=frozen_selectors,
                cause="ui_update_timeout"
            )
            self._freeze_detections.append(report)
            self._observed_freeze = True
            return report

        self._last_ui_update = now
        return None

    def check_pending_requests(
        self,
        timeout_seconds: float = 30.0,
        request_urls: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Check for requests that have not completed within expected time.

        Args:
            timeout_seconds: Maximum time a request should take.
            request_urls: Optional list of specific URLs to monitor.

        Returns:
            List of stalled request information.
        """
        stalled: List[Dict[str, Any]] = []
        now = datetime.now()

        requests_to_check = self._pending_requests.items()
        if request_urls is not None:
            url_set = set(request_urls)
            requests_to_check = [
                (k, v) for k, v in requests_to_check
                if v.url in url_set
            ]

        for request_id, request in requests_to_check:
            if request.response_received:
                continue

            duration = (now - request.started_at).total_seconds()
            if duration > timeout_seconds:
                stalled.append({
                    "request_id": request_id,
                    "url": request.url,
                    "method": request.method,
                    "duration_seconds": duration,
                    "status": request.status,
                    "started_at": request.started_at,
                    "severity": "critical" if duration > timeout_seconds * 2 else "warning"
                })

        return stalled

    def detect_deadlock(
        self,
        ui_state: Dict[str, str],
        pending_requests: List[str],
        circular_dependencies: Optional[List[List[str]]] = None
    ) -> Optional[DeadlockReport]:
        """Detect deadlocks between UI state and pending operations.

        A deadlock occurs when the UI is waiting for a condition that
        cannot be satisfied, or when circular dependencies block progress.

        Args:
            ui_state: Current UI state for each tracked region.
            pending_requests: IDs of currently pending network requests.
            circular_dependencies: Optional list of circular dependency chains.

        Returns:
            DeadlockReport if a deadlock is detected, None otherwise.
        """
        now = datetime.now()
        deadlock_indicators: List[str] = []

        for region, state in ui_state.items():
            self._ui_states[region] = state
            if state == "loading" or state == "pending":
                deadlock_indicators.append(f"region:{region}:{state}")

        for req_id in pending_requests:
            if req_id in self._pending_requests:
                deadlock_indicators.append(f"request:{req_id}")

        if circular_dependencies:
            for chain in circular_dependencies:
                chain_str = " -> ".join(chain)
                deadlock_indicators.append(f"dependency_chain:{chain_str}")

        if len(deadlock_indicators) >= 2:
            has_loading_state = any("loading" in d or "pending" in d for d in deadlock_indicators)
            has_pending_request = any("request:" in d for d in deadlock_indicators)

            if has_loading_state and has_pending_request:
                report = DeadlockReport(
                    detected_at=now,
                    pending_requests=pending_requests,
                    cause="ui_blocked_by_pending_requests",
                    severity="critical",
                    frozen_elements=[d for d in deadlock_indicators if d.startswith("region:")]
                )
                self._freeze_detections.append(report)
                return report

            if circular_dependencies:
                report = DeadlockReport(
                    detected_at=now,
                    cause="circular_dependency_chain",
                    severity="high",
                    frozen_elements=deadlock_indicators
                )
                self._freeze_detections.append(report)
                return report

        return None

    def start_loader(self, selector: str) -> None:
        """Mark a loader as started."""
        self._loaders[selector] = {
            "started_at": datetime.now(),
            "state": "active",
            "resolved": False
        }

    def resolve_loader(self, selector: str) -> None:
        """Mark a loader as resolved."""
        if selector in self._loaders:
            self._loaders[selector]["resolved"] = True
            self._loaders[selector]["state"] = "resolved"
            self._loaders[selector]["resolved_at"] = datetime.now()

    def track_request(
        self,
        request_id: str,
        url: str,
        method: str = "GET"
    ) -> None:
        """Track a new network request."""
        self._pending_requests[request_id] = PendingRequest(
            url=url,
            method=method,
            started_at=datetime.now()
        )

    def complete_request(self, request_id: str) -> None:
        """Mark a request as complete."""
        if request_id in self._pending_requests:
            self._pending_requests[request_id].response_received = True
            self._pending_requests[request_id].status = "completed"

    def record_ui_update(self) -> None:
        """Record that the UI has been updated."""
        self._last_ui_update = datetime.now()

    def _get_element_selectors(self, elements: List[Any]) -> List[str]:
        """Get selector strings for a list of elements."""
        return [self._get_element_selector(e) for e in elements]

    def _get_element_selector(self, element: Any) -> str:
        """Get a unique selector string for an element."""
        tag = getattr(element, "tag_name", "unknown").lower()
        elem_id = getattr(element, "id", None)
        elem_class = getattr(element, "class_name", "")

        if elem_id:
            return f"#{elem_id}"
        if elem_class:
            classes = elem_class.split()[:2]
            return f"{tag}.{'.'.join(classes)}"
        return tag

    def _create_freeze_report(
        self,
        duration_seconds: float,
        frozen_selectors: List[str],
        cause: str
    ) -> DeadlockReport:
        """Create a DeadlockReport for a detected freeze."""
        return DeadlockReport(
            detected_at=datetime.now(),
            freeze_duration_seconds=duration_seconds,
            frozen_elements=frozen_selectors,
            pending_requests=[],
            cause=cause,
            severity="critical" if duration_seconds > self._freeze_threshold * 2 else "high"
        )

    def get_freeze_history(self) -> List[DeadlockReport]:
        """Return all detected freezes."""
        return list(self._freeze_detections)

    def get_pending_requests(self) -> Dict[str, PendingRequest]:
        """Return all tracked pending requests."""
        return dict(self._pending_requests)

    def clear(self) -> None:
        """Clear all detection state."""
        self._loaders.clear()
        self._pending_requests.clear()
        self._ui_states.clear()
        self._freeze_detections.clear()
        self._last_ui_update = None
        self._observed_freeze = False
