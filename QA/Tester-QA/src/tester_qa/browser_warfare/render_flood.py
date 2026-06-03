"""Render Flood module — floods the browser render queue."""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class RenderFloodConfig:
    dom_nodes: int = 5000
    style_changes_per_frame: int = 100
    duration_ms: int = 10000
    throttle_ms: float = 16.0


@dataclass
class RenderFloodResult:
    nodes_created: int = 0
    style_bombs: int = 0
    forced_reflows: int = 0
    estimated_frame_drops: int = 0
    details: dict[str, Any] = field(default_factory=dict)


class RenderFlood:
    """Floods the browser render queue with excessive DOM mutations and style recalculations."""

    def __init__(self, config: RenderFloodConfig | None = None) -> None:
        self.config = config or RenderFloodConfig()

    def flood_render_queue(self, page: Any) -> RenderFloodResult:
        """Flood the render queue with rapid DOM insertions and style mutations."""
        result = RenderFloodResult()
        nodes_per_batch = 200
        batches = self.config.dom_nodes // nodes_per_batch
        for batch in range(batches):
            self._inject_node_batch(page, nodes_per_batch)
            self._bomb_styles(page)
            self._force_reflow(page)
            result.nodes_created += nodes_per_batch
            result.style_bombs += 1
            result.forced_reflows += 1
            time.sleep(self.config.throttle_ms / 1000.0)
        result.estimated_frame_drops = result.style_bombs * self.config.style_changes_per_frame // 60
        result.details = {
            "config": {
                "dom_nodes": self.config.dom_nodes,
                "style_changes_per_frame": self.config.style_changes_per_frame,
                "duration_ms": self.config.duration_ms,
            },
            "batches": batches,
        }
        return result

    def create_render_storm(self, page: Any) -> RenderFloodResult:
        """Generate a render storm by toggling CSS classes on many elements simultaneously."""
        result = RenderFloodResult()
        elements = []
        for i in range(self.config.dom_nodes):
            el_id = f"rf-storm-{i}"
            page.evaluate(
                f"""
                var el = document.createElement('div');
                el.id = '{el_id}';
                el.className = 'storm-base';
                el.textContent = 'Storm {i}';
                document.body.appendChild(el);
                """
            )
            elements.append(el_id)
            result.nodes_created += 1
        classes = [f"storm-class-{j}" for j in range(20)]
        for _ in range(self.config.style_changes_per_frame):
            chosen_class = random.choice(classes)
            batch = elements[:100]
            for el_id in batch:
                page.evaluate(
                    f"""
                    var el = document.getElementById('{el_id}');
                    if (el) el.classList.toggle('{chosen_class}');
                    """
                )
                result.style_bombs += 1
            page.evaluate("void(0);")
            result.forced_reflows += 1
        result.estimated_frame_drops = result.style_bombs // 60
        result.details = {
            "strategy": "render_storm",
            "elements": len(elements),
            "classes": len(classes),
        }
        return result

    def memory_bomb_dom(self, page: Any) -> RenderFloodResult:
        """Bomb the DOM with memory-intensive operations: deep nesting, large text, repeated cloning."""
        result = RenderFloodResult()
        depth = 50
        width = 50
        self._build_deep_tree(page, depth=depth, width=width, prefix="rf-deep")
        result.nodes_created += depth * width
        result.details["deep_tree"] = {"depth": depth, "width": width}
        for i in range(5):
            self._clone_and_append(page, count=100)
            result.nodes_created += 100
            result.style_bombs += 1
        large_text = "X" * 100000
        page.evaluate(f"""
            var el = document.createElement('div');
            el.id = 'rf-large-text';
            el.textContent = '{large_text}';
            document.body.appendChild(el);
        """)
        result.nodes_created += 1
        result.details["large_text_chars"] = len(large_text)
        result.details["strategy"] = "memory_bomb_dom"
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _inject_node_batch(self, page: Any, count: int) -> None:
        ids = ",".join(f"'rf-node-{i}'" for i in range(count))
        page.evaluate(
            f"""
            var ids = [{ids}];
            ids.forEach(function(id) {{
                var el = document.createElement('div');
                el.id = id;
                el.textContent = id;
                document.body.appendChild(el);
            }});
            """
        )

    def _bomb_styles(self, page: Any) -> None:
        properties = ["color", "backgroundColor", "fontSize", "margin", "padding", "width", "height"]
        for _ in range(self.config.style_changes_per_frame):
            prop = random.choice(properties)
            val = f"{random.randint(0, 100)}px"
            page.evaluate(
                f"""
                document.querySelectorAll('div').forEach(function(el) {{
                    el.style['{prop}'] = '{val}';
                }});
                """
            )

    def _force_reflow(self, page: Any) -> None:
        page.evaluate("void document.body.offsetHeight;")

    def _build_deep_tree(self, page: Any, depth: int, width: int, prefix: str) -> None:
        script = f"""
        (function() {{
            var current = document.body;
            for (var d = 0; d < {depth}; d++) {{
                var parent = current;
                for (var w = 0; w < {width}; w++) {{
                    var el = document.createElement('div');
                    el.id = '{prefix}-' + d + '-' + w;
                    el.textContent = 'Node ' + d + ',' + w;
                    parent.appendChild(el);
                }}
                current = parent.firstChild;
            }}
        }})();
        """
        page.evaluate(script)

    def _clone_and_append(self, page: Any, count: int) -> None:
        page.evaluate(
            f"""
            var template = document.createElement('div');
            template.id = 'rf-clone-template';
            template.textContent = 'Clone template';
            document.body.appendChild(template);
            for (var i = 0; i < {count}; i++) {{
                var clone = template.cloneNode(true);
                clone.id = 'rf-clone-' + i;
                document.body.appendChild(clone);
            }}
            """
        )
