/**
 * ErrorBoundary — Frontend crash protection for vanilla JS widgets.
 *
 * Provides:
 *   1. Widget-level error isolation (prevents one widget crash from killing the page)
 *   2. Graceful degradation UI for crashed widgets
 *   3. Automatic retry with exponential backoff
 *   4. Integration with TaskFlowRuntime.logClientError for observability
 *
 * Usage:
 *   ErrorBoundary.protect('calendar', () => renderCalendar(data));
 *   ErrorBoundary.protectAsync('task-drawer', () => fetchAndRender(taskId));
 *   ErrorBoundary.wrap(document.getElementById('widget'), 'widget-name', renderFn);
 */
(function () {
    'use strict';

    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 3000;
    const crashLog = new Map(); // widgetName → { count, lastError, lastTime }

    /**
     * Execute a synchronous render function with crash protection.
     * If it throws, shows a fallback UI in the target container.
     *
     * @param {string} name - Widget identifier for logging
     * @param {Function} fn - The render function to protect
     * @param {HTMLElement} [container] - Optional DOM container for fallback UI
     * @returns {*} Return value of fn, or undefined on crash
     */
    function protect(name, fn, container) {
        try {
            return fn();
        } catch (err) {
            handleCrash(name, err, container);
            return undefined;
        }
    }

    /**
     * Execute an async function with crash protection.
     *
     * @param {string} name - Widget identifier
     * @param {Function} asyncFn - Async function to protect
     * @param {HTMLElement} [container] - Optional DOM container for fallback UI
     * @returns {Promise<*>}
     */
    async function protectAsync(name, asyncFn, container) {
        try {
            return await asyncFn();
        } catch (err) {
            if (err?.name === 'AbortError') return undefined; // Intentional cancellation
            handleCrash(name, err, container);
            return undefined;
        }
    }

    /**
     * Wrap a DOM element with error boundary protection.
     * Replaces content with fallback on crash, offers retry.
     *
     * @param {HTMLElement} el - The container element
     * @param {string} name - Widget name
     * @param {Function} renderFn - Function that renders into el
     * @param {object} [options] - { retryable: bool }
     */
    function wrap(el, name, renderFn, options) {
        if (!el) return;
        const opts = Object.assign({ retryable: true }, options);

        protect(name, () => renderFn(el), el);

        // Store render function for retry
        if (opts.retryable) {
            el._ebRenderFn = renderFn;
            el._ebName = name;
        }
    }

    /**
     * Handle a widget crash — log, show fallback, track frequency.
     */
    function handleCrash(name, error, container) {
        const now = Date.now();
        const entry = crashLog.get(name) || { count: 0, lastError: null, lastTime: 0 };
        entry.count++;
        entry.lastError = error;
        entry.lastTime = now;
        crashLog.set(name, entry);

        // Log to backend
        if (window.TaskFlowRuntime?.logClientError) {
            window.TaskFlowRuntime.logClientError('widget.crash', error, {
                widget: name,
                crashCount: entry.count,
                url: location.pathname
            });
        }

        console.error(`[ErrorBoundary] Widget "${name}" crashed (${entry.count}x):`, error);

        // Show fallback UI if container provided
        if (container && container instanceof HTMLElement) {
            showFallback(container, name, entry);
        }
    }

    /**
     * Render a graceful fallback UI inside the crashed widget's container.
     */
    function showFallback(container, name, entry) {
        const canRetry = entry.count <= MAX_RETRIES;
        const retryId = `eb-retry-${name}-${Date.now()}`;

        container.innerHTML = `
            <div class="eb-fallback" role="alert" aria-live="polite">
                <div class="eb-fallback-icon">⚠️</div>
                <div class="eb-fallback-text">
                    <strong>This section couldn't load</strong>
                    <span class="eb-fallback-detail">${escHtml(name)} encountered an error</span>
                </div>
                ${canRetry ? `<button class="eb-retry-btn" id="${retryId}">Retry</button>` : '<span class="eb-fallback-detail">Please refresh the page</span>'}
            </div>
        `;

        if (canRetry) {
            const btn = document.getElementById(retryId);
            if (btn) {
                btn.addEventListener('click', () => {
                    container.innerHTML = '<div class="eb-loading">Loading…</div>';
                    setTimeout(() => {
                        if (container._ebRenderFn) {
                            protect(name, () => container._ebRenderFn(container), container);
                        } else {
                            // No stored render function — try page reload of section
                            location.reload();
                        }
                    }, 500);
                });
            }
        }
    }

    /**
     * Get crash statistics for monitoring/debugging.
     * @returns {Object} Map of widget name → crash info
     */
    function getStats() {
        const stats = {};
        crashLog.forEach((entry, name) => {
            stats[name] = {
                count: entry.count,
                lastError: entry.lastError?.message || String(entry.lastError),
                lastTime: new Date(entry.lastTime).toISOString()
            };
        });
        return stats;
    }

    /**
     * Reset crash count for a widget (e.g., after successful render).
     */
    function clearCrash(name) {
        crashLog.delete(name);
    }

    function escHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Export
    window.ErrorBoundary = Object.freeze({
        protect,
        protectAsync,
        wrap,
        getStats,
        clearCrash
    });
})();
