"""Stale UI detection for QA testing."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Set


@dataclass
class StaleElement:
    """Represents a stale or unresponsive UI element."""
    selector: str
    reason: str
    detected_at: datetime = field(default_factory=datetime.now)
    last_update: Optional[datetime] = None
    element_snapshot: Optional[Dict[str, Any]] = None


class StaleUIDetector:
    """Detects stale, unresponsive, and zombie UI elements.

    Identifies elements that remain on screen after their underlying
    state has changed, or elements that appear to be interactive
    but do not respond to user input.
    """

    def __init__(self, stale_threshold_seconds: float = 30.0) -> None:
        self._stale_threshold = timedelta(seconds=stale_threshold_seconds)
        self._tracked_elements: Dict[str, Dict[str, Any]] = {}
        self._zombie_ui_elements: List[StaleElement] = []
        self._state_timestamps: Dict[str, datetime] = {}
        self._freshness_checks: List[Dict[str, Any]] = []

    def detect_stale_elements(
        self,
        elements: List[Any],
        current_state: Optional[Dict[str, Any]] = None,
        threshold_seconds: Optional[float] = None
    ) -> List[StaleElement]:
        """Detect elements that are stale or out of sync.

        Args:
            elements: List of DOM elements to check.
            current_state: Current application state to compare against.
            threshold_seconds: Custom staleness threshold.

        Returns:
            List of StaleElement objects representing stale UI.
        """
        stale_elements: List[StaleElement] = []
        threshold = (
            timedelta(seconds=threshold_seconds)
            if threshold_seconds is not None
            else self._stale_threshold
        )

        for element in elements:
            selector = self._get_element_selector(element)
            last_update = self._state_timestamps.get(selector)

            if last_update is not None:
                age = datetime.now() - last_update
                if age > threshold:
                    stale_elements.append(StaleElement(
                        selector=selector,
                        reason=f"element unchanged for {age.total_seconds():.1f}s",
                        last_update=last_update,
                        element_snapshot=self._snapshot_element(element)
                    ))
            else:
                self._state_timestamps[selector] = datetime.now()

        return stale_elements

    def find_zombie_ui(
        self,
        visible_elements: List[Any],
        active_state_keys: Set[str],
        dom_state_keys: Set[str]
    ) -> List[StaleElement]:
        """Find zombie UI elements that exist in DOM but not in active state.

        Zombie UI elements are DOM nodes that appear visible but have no
        corresponding entry in the application state, or whose state
        has been removed or invalidated.

        Args:
            visible_elements: Elements currently visible in the DOM.
            active_state_keys: Keys in the current application state.
            dom_state_keys: Keys extracted from DOM data attributes.

        Returns:
            List of zombie UI elements.
        """
        zombies: List[StaleElement] = []

        orphaned_keys = dom_state_keys - active_state_keys
        for key in orphaned_keys:
            selector = f"[data-state-key='{key}']"
            matching_elements = [
                e for e in visible_elements
                if self._get_element_selector(e) == selector
            ]
            if matching_elements:
                zombies.append(StaleElement(
                    selector=selector,
                    reason=f"orphaned state key '{key}' has no active state",
                    element_snapshot={"state_key": key}
                ))

        for element in visible_elements:
            selector = self._get_element_selector(element)
            if self._appears_zombie(element):
                zombies.append(StaleElement(
                    selector=selector,
                    reason="element appears visible but does not respond",
                    element_snapshot=self._snapshot_element(element)
                ))

        self._zombie_ui_elements.extend(zombies)
        return zombies

    def check_ui_freshness(
        self,
        region_selectors: List[str],
        expected_max_age_seconds: float = 5.0
    ) -> Dict[str, Dict[str, Any]]:
        """Check if UI regions have been updated recently.

        Args:
            region_selectors: CSS selectors for UI regions to check.
            expected_max_age_seconds: Maximum acceptable age for each region.

        Returns:
            Dictionary mapping region selectors to freshness status.
        """
        results: Dict[str, Dict[str, Any]] = {}
        max_age = timedelta(seconds=expected_max_age_seconds)

        for selector in region_selectors:
            last_update = self._state_timestamps.get(selector)
            now = datetime.now()

            if last_update is None:
                results[selector] = {
                    "fresh": False,
                    "reason": "no_update_recorded",
                    "age_seconds": None
                }
            else:
                age = now - last_update
                is_fresh = age <= max_age
                results[selector] = {
                    "fresh": is_fresh,
                    "age_seconds": age.total_seconds(),
                    "last_update": last_update,
                    "stale": not is_fresh
                }

            self._freshness_checks.append({
                "selector": selector,
                "checked_at": now,
                "result": results[selector]
            })

        return results

    def detect_stale_state(
        self,
        application_state: Dict[str, Any],
        rendered_elements: List[Any],
        component_names: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Detect state that is stale or inconsistent with rendered UI.

        Args:
            application_state: Current application state dictionary.
            rendered_elements: Elements currently rendered in DOM.
            component_names: Optional list of specific components to check.

        Returns:
            List of detected stale state issues with details.
        """
        issues: List[Dict[str, Any]] = []

        state_keys = set(application_state.keys())
        element_keys = self._extract_state_keys_from_elements(rendered_elements)

        missing_in_dom = state_keys - element_keys
        for key in missing_in_dom:
            issues.append({
                "type": "state_without_renderer",
                "key": key,
                "severity": "medium",
                "description": f"state key '{key}' has no corresponding renderer"
            })

        extra_in_dom = element_keys - state_keys
        for key in extra_in_dom:
            issues.append({
                "type": "renderer_without_state",
                "key": key,
                "severity": "low",
                "description": f"renderer for '{key}' exists but no matching state"
            })

        if component_names:
            for comp_name in component_names:
                comp_key = f"component:{comp_name}"
                last_update = self._state_timestamps.get(comp_key)
                if last_update:
                    age = datetime.now() - last_update
                    if age > self._stale_threshold:
                        issues.append({
                            "type": "stale_component",
                            "component": comp_name,
                            "age_seconds": age.total_seconds(),
                            "severity": "high",
                            "description": f"component '{comp_name}' has not updated in {age.total_seconds():.1f}s"
                        })

        return issues

    def track_element(self, selector: str, element: Any) -> None:
        """Begin tracking an element for staleness."""
        self._tracked_elements[selector] = {
            "element": element,
            "first_seen": datetime.now(),
            "last_seen": datetime.now()
        }

    def update_element_timestamp(self, selector: str) -> None:
        """Update the last-seen timestamp for a tracked element."""
        if selector in self._tracked_elements:
            self._tracked_elements[selector]["last_seen"] = datetime.now()
        self._state_timestamps[selector] = datetime.now()

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

    def _snapshot_element(self, element: Any) -> Dict[str, Any]:
        """Capture a snapshot of an element's current state."""
        return {
            "tag_name": getattr(element, "tag_name", "UNKNOWN"),
            "text_content": getattr(element, "text_content", ""),
            "inner_html": getattr(element, "inner_html", ""),
            "id": getattr(element, "id", None),
            "class_name": getattr(element, "class_name", ""),
            "visible": getattr(element, "is_visible", lambda: True)()
        }

    def _extract_state_keys_from_elements(
        self,
        elements: List[Any]
    ) -> Set[str]:
        """Extract state keys from elements via data attributes."""
        keys: Set[str] = set()
        for element in elements:
            data_state = getattr(element, "get_attribute", lambda x: None)
            state_key = data_state("data-state-key")
            if state_key:
                keys.add(state_key)
        return keys

    def _appears_zombie(self, element: Any) -> bool:
        """Check if an element appears to be zombie UI."""
        try:
            is_visible = getattr(element, "is_visible", lambda: True)
            is_attached = getattr(element, "is_attached_to_dom", lambda: True)
            if is_visible() and is_attached():
                return False
        except Exception:
            pass
        return True

    def get_tracked_elements(self) -> Dict[str, Dict[str, Any]]:
        """Return all currently tracked elements."""
        return dict(self._tracked_elements)

    def clear(self) -> None:
        """Clear all tracking data."""
        self._tracked_elements.clear()
        self._zombie_ui_elements.clear()
        self._state_timestamps.clear()
        self._freshness_checks.clear()
