"""Hydration Breaker module — breaks SSR hydration contracts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class HydrationBreakerConfig:
    mismatched_attributes: int = 200
    extra_server_nodes: int = 1000
    removed_client_nodes: int = 500
    corrupt_state_keys: int = 50


@dataclass
class HydrationBreakerResult:
    mismatched_nodes: int = 0
    extra_nodes_inserted: int = 0
    nodes_removed: int = 0
    state_corruptions: int = 0
    details: dict[str, Any] = field(default_factory=dict)


class HydrationBreaker:
    """Breaks hydration contracts between server-rendered HTML and client JavaScript state."""

    def __init__(self, config: HydrationBreakerConfig | None = None) -> None:
        self.config = config or HydrationBreakerConfig()

    def break_hydration(self, page: Any) -> HydrationBreakerResult:
        """Break hydration by injecting mismatched attributes and extra/removed DOM nodes."""
        result = HydrationBreakerResult()
        result.mismatched_nodes = self._inject_mismatched_attributes(page)
        result.extra_nodes_inserted = self._inject_extra_server_nodes(page)
        result.nodes_removed = self._remove_client_nodes(page)
        result.state_corruptions = self._corrupt_hydration_state(page)
        result.details = {
            "config": {
                "mismatched_attributes": self.config.mismatched_attributes,
                "extra_server_nodes": self.config.extra_server_nodes,
                "removed_client_nodes": self.config.removed_client_nodes,
                "corrupt_state_keys": self.config.corrupt_state_keys,
            }
        }
        return result

    def corrupt_server_state(self, page: Any) -> HydrationBreakerResult:
        """Corrupt the server state object to create a client/server state mismatch."""
        result = HydrationBreakerResult()
        state_keys = [f"state_key_{i}" for i in range(self.config.corrupt_state_keys)]
        mismatches = 0
        for key in state_keys:
            corruption_type = mismatches % 3
            if corruption_type == 0:
                page.evaluate(
                    f"window.__INITIAL_STATE__['{key}'] = undefined;"
                )
            elif corruption_type == 1:
                page.evaluate(
                    f"window.__INITIAL_STATE__['{key}'] = {{'__corrupted__': true, 'value': 'bad' }};"
                )
            else:
                page.evaluate(
                    f"Object.defineProperty(window.__INITIAL_STATE__, '{key}', {{value: null, writable: true}});"
                )
            mismatches += 1
        result.state_corruptions = mismatches
        result.details = {
            "strategy": "corrupt_server_state",
            "corrupted_keys": len(state_keys),
        }
        return result

    def send_mismatched_data(self, page: Any) -> HydrationBreakerResult:
        """Send data that does not match the server-rendered DOM structure."""
        result = HydrationBreakerResult()
        data_pairs = []
        for i in range(self.config.mismatched_attributes):
            key = f"data-mismatch-{i}"
            val = f"mismatch_value_{i}"
            data_pairs.append(f"'{key}': '{val}'")
            result.mismatched_nodes += 1
        data_obj = "{" + ",".join(data_pairs) + "}"
        page.evaluate(
            f"""
            var mismatchData = {data_obj};
            Object.keys(mismatchData).forEach(function(key) {{
                var el = document.createElement('div');
                el.setAttribute(key, mismatchData[key]);
                el.id = 'mm-' + key;
                document.body.appendChild(el);
            }});
            """
        )
        page.evaluate(
            """
            window.__HYDRATION_MISMATCH__ = true;
            window.__SERVER_VERSION__ = '1.0.0';
            window.__CLIENT_VERSION__ = '9.9.9';
            """
        )
        result.details = {
            "strategy": "send_mismatched_data",
            "mismatched_attributes": self.config.mismatched_attributes,
        }
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _inject_mismatched_attributes(self, page: Any) -> int:
        count = self.config.mismatched_attributes
        attrs = ",".join(f"'data-hydration-broken-{i}': 'injected-val-{i}'" for i in range(count))
        page.evaluate(
            f"""
            (function() {{
                var attrs = {{{attrs}}};
                Object.keys(attrs).forEach(function(key) {{
                    var el = document.createElement('span');
                    el.setAttribute(key, attrs[key]);
                    el.className = 'hydration-broken';
                    document.body.appendChild(el);
                }});
            }})();
            """
        )
        return count

    def _inject_extra_server_nodes(self, page: Any) -> int:
        count = self.config.extra_server_nodes
        page.evaluate(
            f"""
            (function() {{
                for (var i = 0; i < {count}; i++) {{
                    var el = document.createElement('div');
                    el.id = 'hb-extra-server-' + i;
                    el.setAttribute('data-server-rendered', 'true');
                    el.textContent = 'Extra server node ' + i;
                    document.body.appendChild(el);
                }}
            }})();
            """
        )
        return count

    def _remove_client_nodes(self, page: Any) -> int:
        count = self.config.removed_client_nodes
        page.evaluate(
            f"""
            (function() {{
                var nodes = document.querySelectorAll('div, span, p, section, article');
                var removed = 0;
                for (var i = 0; i < {count} && i < nodes.length; i++) {{
                    nodes[i].remove();
                    removed++;
                }}
            }})();
            """
        )
        return min(count, self.config.extra_server_nodes)

    def _corrupt_hydration_state(self, page: Any) -> int:
        page.evaluate(
            f"""
            if (!window.__INITIAL_STATE__) {{
                window.__INITIAL_STATE__ = {{}};
            }}
            """
        )
        count = self.config.corrupt_state_keys
        for i in range(count):
            page.evaluate(
                f"window.__INITIAL_STATE__['hb_key_{i}'] = {{'__corrupted__': {'true' if i % 2 == 0 else 'false'}}};"
            )
        return count
