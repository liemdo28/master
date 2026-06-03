"""Async Deadlock module — creates promise chain deadlocks and unhandled rejection bombs."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class AsyncDeadlockConfig:
    chain_length: int = 100
    deadlock_depth: int = 50
    rejection_bombs: int = 200


@dataclass
class AsyncDeadlockResult:
    chains_created: int = 0
    deadlock_depth_achieved: int = 0
    rejections_thrown: int = 0
    details: dict[str, Any] = field(default_factory=dict)


class AsyncDeadlock:
    """Creates deep promise chain deadlocks and unhandled rejection bombs in the browser."""

    def __init__(self, config: AsyncDeadlockConfig | None = None) -> None:
        self.config = config or AsyncDeadlockConfig()

    def create_promise_chain(self, page: Any) -> AsyncDeadlockResult:
        """Create long, nested promise chains that overwhelm the microtask queue."""
        result = AsyncDeadlockResult()
        depth = self.config.chain_length
        js = f"""
        (function() {{
            var depth = {depth};
            var count = 0;
            function buildChain(n) {{
                if (n <= 0) {{
                    return Promise.resolve(n);
                }}
                count++;
                return Promise.resolve(n - 1).then(function(val) {{
                    return buildChain(val);
                }});
            }}
            buildChain(depth);
            window.__CHAIN_COUNT__ = count;
        }})();
        """
        page.evaluate(js)
        chain_count = page.evaluate("return window.__CHAIN_COUNT__;")
        result.chains_created = chain_count or 0
        result.details = {
            "strategy": "create_promise_chain",
            "chain_length": self.config.chain_length,
        }
        return result

    def trigger_await_deadlock(self, page: Any) -> AsyncDeadlockResult:
        """Trigger a deadlock via mutually awaiting promises."""
        result = AsyncDeadlockResult()
        depth = self.config.deadlock_depth
        js = f"""
        (function() {{
            var deadlockDepth = {depth};
            var achieved = 0;
            function makeResolver() {{
                var resolve, reject;
                var promise = new Promise(function(res, rej) {{
                    resolve = res;
                    reject = rej;
                }});
                return {{promise: promise, resolve: resolve, reject: reject}};
            }}
            var resolvers = [];
            for (var i = 0; i < deadlockDepth; i++) {{
                resolvers.push(makeResolver());
            }}
            for (var i = 0; i < deadlockDepth; i++) {{
                var curr = resolvers[i];
                var next = resolvers[(i + 1) % deadlockDepth];
                curr.promise.then(function() {{
                    achieved++;
                    next.resolve();
                }});
            }}
            resolvers[0].resolve();
            window.__DEADLOCK_DEPTH__ = achieved;
        }})();
        """
        page.evaluate(js)
        time.sleep(1)
        depth_achieved = page.evaluate("return window.__DEADLOCK_DEPTH__;")
        result.deadlock_depth_achieved = depth_achieved or 0
        result.details = {
            "strategy": "trigger_await_deadlock",
            "planned_depth": self.config.deadlock_depth,
            "achieved_depth": result.deadlock_depth_achieved,
        }
        return result

    def unhandled_rejection_bomb(self, page: Any) -> AsyncDeadlockResult:
        """Bomb the browser with unhandled promise rejections."""
        result = AsyncDeadlockResult()
        count = self.config.rejection_bombs
        js = f"""
        (function() {{
            var count = {count};
            var thrown = 0;
            for (var i = 0; i < count; i++) {{
                (function(index) {{
                    Promise.reject(new Error('Unhandled rejection bomb #' + index));
                    thrown++;
                }})(i);
            }}
            window.__REJECTION_BOMB_COUNT__ = thrown;
        }})();
        """
        page.evaluate(js)
        time.sleep(0.5)
        rejection_count = page.evaluate("return window.__REJECTION_BOMB_COUNT__;")
        result.rejections_thrown = rejection_count or 0
        result.details = {
            "strategy": "unhandled_rejection_bomb",
            "rejections_thrown": result.rejections_thrown,
        }
        return result
