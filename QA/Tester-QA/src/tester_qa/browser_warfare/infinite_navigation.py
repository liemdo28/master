"""Infinite Navigation module — creates infinite routing loops and history explosions."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class InfiniteNavigationConfig:
    max_iterations: int = 10000
    delay_ms: int = 1
    history_entries: int = 5000


@dataclass
class InfiniteNavigationResult:
    iterations: int = 0
    history_entries_added: int = 0
    memory_leaks_detected: bool = False
    details: dict[str, Any] = field(default_factory=dict)


class InfiniteNavigation:
    """Creates infinite routing loops, history explosions, and memory leaks via navigation."""

    def __init__(self, config: InfiniteNavigationConfig | None = None) -> None:
        self.config = config or InfiniteNavigationConfig()

    def infinite_route_loop(self, page: Any) -> InfiniteNavigationResult:
        """Create an infinite route loop by repeatedly changing the hash or URL path."""
        result = InfiniteNavigationResult()
        js = f"""
        (function() {{
            var iterations = {self.config.max_iterations};
            var delay = {self.config.delay_ms};
            var count = 0;
            var baseUrl = window.location.href.split('#')[0];
            function loop(i) {{
                if (i >= iterations) {{
                    window.__LOOP_RESULT__ = {{count: count}};
                    return;
                }}
                var hash = '/route-loop-' + i;
                window.location.hash = hash;
                count++;
                if (delay > 0) {{
                    setTimeout(function() {{ loop(i + 1); }}, delay);
                }} else {{
                    loop(i + 1);
                }}
            }}
            loop(0);
        }})();
        """
        page.evaluate(js)
        time.sleep(3)
        raw = page.evaluate("return window.__LOOP_RESULT__;")
        if raw:
            result.iterations = raw.get("count", 0)
        result.details = {
            "strategy": "infinite_route_loop",
            "max_iterations": self.config.max_iterations,
        }
        return result

    def history_explosion(self, page: Any) -> InfiniteNavigationResult:
        """Explode the browser history by pushing thousands of entries."""
        result = InfiniteNavigationResult()
        count = self.config.history_entries
        js = f"""
        (function() {{
            var count = {count};
            var base = window.location.pathname;
            for (var i = 0; i < count; i++) {{
                var url = base + '/history-bomb-' + i;
                window.history.pushState({{index: i}}, '', url);
            }}
            window.__HISTORY_RESULT__ = {{pushed: count}};
        }})();
        """
        page.evaluate(js)
        result.history_entries_added = count
        history_length = page.evaluate("return window.history.length;")
        result.details = {
            "strategy": "history_explosion",
            "entries_added": count,
            "history_length_after": history_length,
        }
        return result

    def memory_leak_navigation(self, page: Any) -> InfiniteNavigationResult:
        """Create memory leaks by attaching event listeners and closures on each navigation."""
        result = InfiniteNavigationResult()
        js = f"""
        (function() {{
            var leaks = [];
            var base = window.location.pathname;
            var count = 0;
            for (var i = 0; i < {self.config.history_entries // 10}; i++) {{
                (function(index) {{
                    var captured = new Array(10000).fill('leak-' + index);
                    var handler = function() {{
                        window.__LEAK_DATA__ = captured;
                    }};
                    window.addEventListener('storage', handler);
                    var url = base + '/leak-nav-' + index;
                    window.history.pushState({{index: index}}, '', url);
                    leaks.push({{url: url, handler: handler, data: captured}});
                    count++;
                }})(i);
            }}
            window.__MEM_LEAK_NAVS__ = leaks;
            window.__LEAK_NAV_COUNT__ = count;
        }})();
        """
        page.evaluate(js)
        leak_count = page.evaluate("return window.__LEAK_NAV_COUNT__;")
        result.iterations = leak_count or 0
        result.memory_leaks_detected = True
        result.details = {
            "strategy": "memory_leak_navigation",
            "leaked_handlers": leak_count,
        }
        return result
