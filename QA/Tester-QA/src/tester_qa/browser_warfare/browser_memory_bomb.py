"""Browser Memory Bomb module — allocates JavaScript heap memory and creates leaks."""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class BrowserMemoryBombConfig:
    allocation_bytes: int = 100_000_000
    closure_leaks: int = 500
    dom_node_flood: int = 10000
    interval_ms: int = 100


@dataclass
class BrowserMemoryBombResult:
    bytes_allocated: int = 0
    closures_leaked: int = 0
    dom_nodes_flooded: int = 0
    estimated_heap_growth_mb: float = 0.0
    details: dict[str, Any] = field(default_factory=dict)


class BrowserMemoryBomb:
    """Bombards the browser JavaScript heap with allocations, closure leaks, and DOM floods."""

    def __init__(self, config: BrowserMemoryBombConfig | None = None) -> None:
        self.config = config or BrowserMemoryBombConfig()

    def allocate_js_heap(self, page: Any) -> BrowserMemoryBombResult:
        """Aggressively allocate JavaScript heap memory in large chunks."""
        result = BrowserMemoryBombResult()
        chunk_size = 1_000_000
        chunks = self.config.allocation_bytes // chunk_size
        js = f"""
        (function() {{
            var chunkSize = {chunk_size};
            var chunks = {chunks};
            var leaks = [];
            var totalBytes = 0;
            for (var i = 0; i < chunks; i++) {{
                var buf = new Array(chunkSize);
                for (var j = 0; j < chunkSize; j++) {{
                    buf[j] = Math.random().toString(36);
                }}
                leaks.push(buf);
                totalBytes += chunkSize;
            }}
            window.__HEAP_LEAKS__ = leaks;
            window.__TOTAL_BYTES_ALLOCATED__ = totalBytes;
        }})();
        """
        page.evaluate(js)
        time.sleep(1)
        bytes_alloc = page.evaluate("return window.__TOTAL_BYTES_ALLOCATED__;")
        result.bytes_allocated = bytes_alloc or 0
        result.estimated_heap_growth_mb = result.bytes_allocated / (1024 * 1024)
        result.details = {
            "strategy": "allocate_js_heap",
            "chunk_size": chunk_size,
            "chunks": chunks,
            "total_bytes": result.bytes_allocated,
        }
        return result

    def leak_closures(self, page: Any) -> BrowserMemoryBombResult:
        """Leak memory by capturing large objects in closures that never get released."""
        result = BrowserMemoryBombResult()
        count = self.config.closure_leaks
        js = f"""
        (function() {{
            var count = {count};
            var leakedClosures = [];
            for (var i = 0; i < count; i++) {{
                (function(index) {{
                    var largeData = new Array(10000).fill('closure-leak-' + index);
                    var reference = {{
                        id: index,
                        data: largeData,
                        timestamp: Date.now()
                    }};
                    window['__closure_leak_' + index + '__'] = reference;
                    leakedClosures.push(reference);
                }})(i);
            }}
            window.__CLOSURE_LEAKS__ = leakedClosures;
        }})();
        """
        page.evaluate(js)
        result.closures_leaked = count
        result.details = {
            "strategy": "leak_closures",
            "closures_leaked": count,
        }
        return result

    def dom_node_flood(self, page: Any) -> BrowserMemoryBombResult:
        """Flood the DOM with a massive number of nodes to consume browser memory."""
        result = BrowserMemoryBombResult()
        count = self.config.dom_node_flood
        js = f"""
        (function() {{
            var count = {count};
            var container = document.createElement('div');
            container.id = 'bmb-flood-container';
            document.body.appendChild(container);
            for (var i = 0; i < count; i++) {{
                var el = document.createElement('div');
                el.id = 'bmb-node-' + i;
                el.className = 'bmb-flood-node';
                el.textContent = 'Memory bomb node ' + i + ' ' + new Array(100).join('X');
                container.appendChild(el);
            }}
            window.__DOM_FLOOD_COUNT__ = count;
        }})();
        """
        page.evaluate(js)
        result.dom_nodes_flooded = count
        result.estimated_heap_growth_mb = (count * 500) / (1024 * 1024)
        result.details = {
            "strategy": "dom_node_flood",
            "nodes_flooded": count,
            "estimated_mb": result.estimated_heap_growth_mb,
        }
        return result
