"""Render trace — tracks FPS and detects layout thrashing during warfare."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# JS injected to monitor FPS and detect layout thrashing
_START_RENDER_TRACE_JS = """() => {
    if (window.__tqa_render_tracing__) return;
    window.__tqa_render_tracing__ = true;
    window.__tqa_render_metrics__ = {
        fpsSamples: [],
        forcedReflows: 0,
        styleRecalcs: 0,
        layoutThrashingEvents: [],
        startedAt: Date.now(),
    };

    let lastTime = performance.now();
    let frameCount = 0;
    let fpsAccum = 0;
    const _requestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = function(cb) {
        return _requestAnimationFrame(function(t) {
            const delta = t - lastTime;
            frameCount++;
            fpsAccum += delta;
            if (fpsAccum >= 1000) {
                const fps = Math.round((frameCount * 1000) / fpsAccum);
                window.__tqa_render_metrics__.fpsSamples.push(fps);
                frameCount = 0;
                fpsAccum = 0;
            }
            lastTime = t;
            cb(t);
        });
    };

    // Intercept getBoundingClientRect etc. which force layout
    const reflowMethods = [
        'getBoundingClientRect', 'getClientRects', 'offsetWidth', 'offsetHeight',
        'offsetLeft', 'offsetTop', 'offsetParent', 'scrollWidth', 'scrollHeight',
        'scrollLeft', 'scrollTop', 'scrollX', 'scrollY', 'clientWidth', 'clientHeight',
    ];
    reflowMethods.forEach(function(method) {
        const proto = Element.prototype;
        const orig = proto[method];
        if (typeof orig !== 'function') return;
        proto[method] = function() {
            window.__tqa_render_metrics__.forcedReflows++;
            return orig.apply(this, arguments);
        };
    });
}"""

_STOP_RENDER_TRACE_JS = """() => {
    if (!window.__tqa_render_tracing__) return null;
    const metrics = Object.assign({}, window.__tqa_render_metrics__);
    window.__tqa_render_tracing__ = false;
    const samples = metrics.fpsSamples || [];
    const avgFps = samples.length
        ? Math.round(samples.reduce(function(a, b) { return a + b; }, 0) / samples.length)
        : 0;
    const minFps = samples.length ? Math.min.apply(null, samples) : 0;
    const maxFps = samples.length ? Math.max.apply(null, samples) : 0;
    const duration = metrics.startedAt ? Date.now() - metrics.startedAt : 0;
    return {
        avgFps,
        minFps,
        maxFps,
        fpsSamples: samples,
        forcedReflows: metrics.forcedReflows || 0,
        durationMs: duration,
        severeThrashing: metrics.forcedReflows > 500,
    };
}"""


class RenderTrace:
    """Tracks render performance by injecting FPS monitoring and thrashing detection."""

    def __init__(self) -> None:
        self._page: Any = None

    def start_tracing(self, page: Any) -> None:
        """Start render tracing on the given page.

        Args:
            page: A live Playwright page object.
        """
        self._page = page
        try:
            page.evaluate(_START_RENDER_TRACE_JS)
            logger.debug("[RenderTrace] Tracing started")
        except Exception as e:
            logger.warning("[RenderTrace] start_tracing failed: %s", e)

    def stop_tracing(self) -> dict[str, Any]:
        """Stop tracing and return collected render metrics.

        Returns:
            Dict with avgFps, minFps, maxFps, forcedReflows, severeThrashing.
        """
        if self._page is None:
            return {"error": "No page active"}
        try:
            return self._page.evaluate(_STOP_RENDER_TRACE_JS) or {}
        except Exception as e:
            logger.warning("[RenderTrace] stop_tracing failed: %s", e)
            return {"error": str(e)}

    def get_current_fps(self) -> int:
        """Poll current FPS from the page's last sample."""
        if self._page is None:
            return 0
        try:
            return self._page.evaluate(
                """() => {
                    const s = window.__tqa_render_metrics__;
                    return (s && s.fpsSamples && s.fpsSamples.length)
                        ? s.fpsSamples[s.fpsSamples.length - 1]
                        : 0;
                }"""
            )
        except Exception:
            return 0
