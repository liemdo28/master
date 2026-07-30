/**
 * TaskFlow v2 - Main JS
 */

// Lightweight runtime guardrails for long-running dashboard sessions.
window.TaskFlowRuntime = window.TaskFlowRuntime || (function () {
    const activeRequests = new Map();
    const sentErrors = new Set();
    const defaultTimeoutMs = 12000;

    function timeoutFetch(key, url, options = {}, timeoutMs = defaultTimeoutMs) {
        if (key && activeRequests.has(key)) {
            activeRequests.get(key).abort();
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const merged = Object.assign({}, options, { signal: controller.signal });
        if (key) activeRequests.set(key, controller);
        return fetch(url, merged)
            .finally(() => {
                clearTimeout(timer);
                if (key && activeRequests.get(key) === controller) activeRequests.delete(key);
            });
    }

    function logClientError(kind, error, context = {}) {
        const message = String(error?.message || error || 'unknown');
        const fingerprint = `${kind}:${message}:${context.url || location.pathname}`;
        if (sentErrors.has(fingerprint)) return;
        sentErrors.add(fingerprint);
        setTimeout(() => sentErrors.delete(fingerprint), 60000);

        const payload = JSON.stringify({
            kind,
            message,
            stack: error?.stack ? String(error.stack).slice(0, 1600) : '',
            context,
            path: location.pathname,
            ts: new Date().toISOString()
        });

        if (navigator.sendBeacon) {
            navigator.sendBeacon((window.APP_URL || '') + '/api/client-log', new Blob([payload], { type: 'application/json' }));
        } else {
            fetch((window.APP_URL || '') + '/api/client-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: payload,
                keepalive: true
            }).catch(() => { });
        }
    }

    function scheduleVisibleInterval(fn, ms) {
        let timer = null;
        const tick = () => {
            if (!document.hidden) fn();
            timer = setTimeout(tick, ms);
        };
        timer = setTimeout(tick, ms);
        return () => clearTimeout(timer);
    }

    return { timeoutFetch, logClientError, scheduleVisibleInterval };
})();

// Auto-dismiss alerts
document.querySelectorAll('.alert').forEach(a => {
    setTimeout(() => { a.style.opacity = '0'; a.style.transition = 'opacity .3s'; setTimeout(() => a.remove(), 300); }, 4000);
});

// ============================================
// Sidebar - desktop & mobile
// ============================================
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (!sb) return;
    sb.classList.toggle('open');
    if (bd) bd.classList.toggle('active', sb.classList.contains('open'));
}

function closeSidebar() {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebarBackdrop');
    sb?.classList.remove('open');
    bd?.classList.remove('active');
}

// Close sidebar on nav item click (mobile)
document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.addEventListener('click', closeSidebar);
});

// Close sidebar on outside click (mobile)
document.addEventListener('click', e => {
    const sb = document.getElementById('sidebar');
    const tog = document.querySelector('.mobile-toggle');
    if (sb?.classList.contains('open') && !sb.contains(e.target) && !tog?.contains(e.target)) {
        closeSidebar();
    }
});

// ============================================
// Swipe gesture for sidebar (mobile)
// ============================================
(function () {
    let touchStartX = 0;
    let touchStartY = 0;
    let swiping = false;

    document.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        swiping = false;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        if (swiping) return;
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        // Only trigger for horizontal swipes
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
            swiping = true;
            const sb = document.getElementById('sidebar');
            if (dx > 0 && touchStartX < 40 && !sb.classList.contains('open')) {
                // Swipe right from left edge -> open sidebar
                toggleSidebar();
            } else if (dx < 0 && sb.classList.contains('open')) {
                // Swipe left -> close sidebar
                closeSidebar();
            }
        }
    }, { passive: true });
})();

// ============================================
// ESC to close modals
// ============================================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active,.modal-overlay.open').forEach(m => {
            m.classList.remove('active');
            m.classList.remove('open');
        });
        const nd = document.getElementById('notifDropdown');
        if (nd) nd.classList.remove('open');
        closeSidebar();
    }
});

// ============================================
// Notification dropdown
// ============================================
let notifLoaded = false;

function toggleNotifDropdown() {
    const dd = document.getElementById('notifDropdown');
    if (!dd) return;
    dd.classList.toggle('open');
    if (dd.classList.contains('open') && !notifLoaded) loadNotifications();
}

let notifFailureCount = 0;
let notifRetryTimer = null;

function loadNotifications() {
    if (document.hidden) return Promise.resolve();
    const list = document.getElementById('notifList');
    if (!list) return Promise.resolve();

    return window.TaskFlowRuntime.timeoutFetch(
        'notifications',
        (window.APP_URL || '') + '/api/notifications',
        { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' },
        10000
    )
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(data => {
            notifLoaded = true;
            notifFailureCount = 0;
            if (notifRetryTimer) {
                clearTimeout(notifRetryTimer);
                notifRetryTimer = null;
            }
            if (!data.notifications?.length) {
                list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:12px">No notifications</div>';
                return;
            }
            const iconTypes = {
                task_assigned: 'target', task_commented: 'hash',
                task_due_soon: 'clock', task_overdue: 'alert-triangle', task_completed: 'check-circle'
            };
            const colors = {
                task_assigned: 'var(--blue)', task_commented: 'var(--purple)',
                task_due_soon: 'var(--amber)', task_overdue: 'var(--accent)', task_completed: 'var(--green)'
            };
            list.innerHTML = data.notifications.slice(0, 15).map(n => {
                const color = colors[n.type] || 'var(--text-muted)';
                const href = n.task_id ? '/tasks/' + n.task_id : '/inbox';
                const unread = !n.is_read ? 'unread' : '';
                return `<a href="${href}" class="inbox-item ${unread}" style="text-decoration:none;color:inherit" onclick="fetch('/api/notifications/${n.id}/read',{method:'PUT'})">
                    <div class="inbox-dot" style="background:${color}"></div>
                    <div class="inbox-body">
                        <div class="inbox-title">${esc(n.title)}</div>
                        <div class="inbox-msg">${esc(n.message || '')}</div>
                    </div>
                    <div class="inbox-time">${timeAgo(n.created_at)}</div>
                </a>`;
            }).join('');
        })
        .catch(err => {
            if (err?.name === 'AbortError') return;
            notifFailureCount += 1;
            window.TaskFlowRuntime.logClientError('notifications.load', err, { failures: notifFailureCount });
            list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:11px">Failed to load. Retrying…</div>';
            const backoffMs = Math.min(60000, 2000 * Math.pow(2, Math.min(notifFailureCount, 5)));
            if (!notifRetryTimer) {
                notifRetryTimer = setTimeout(() => {
                    notifRetryTimer = null;
                    loadNotifications();
                }, backoffMs);
            }
        });
}

function markAllNotifRead() {
    window.TaskFlowRuntime.timeoutFetch('notifications.readAll', (window.APP_URL || '') + '/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
    }, 10000)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); })
        .then(() => {
            const badge = document.querySelector('.notif-badge');
            if (badge) badge.remove();
            notifLoaded = false;
            loadNotifications();
        })
        .catch(err => {
            if (err?.name !== 'AbortError') {
                console.warn('[TaskFlow] Failed to mark notifications read:', err);
                window.TaskFlowRuntime.logClientError('notifications.readAll', err);
            }
        });
}

// Poll for new notifications every 30 seconds
// Guard: only one poller per page (avoid duplicate on re-include)
if (!window._notifPollerStarted) {
    window._notifPollerStarted = true;
    window.TaskFlowRuntime.scheduleVisibleInterval(loadNotifications, 30000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) loadNotifications();
    });
}

// Close notif dropdown on outside click
document.addEventListener('click', e => {
    const wrap = document.getElementById('notifWrap');
    const dd = document.getElementById('notifDropdown');
    if (dd?.classList.contains('open') && wrap && !wrap.contains(e.target)) dd.classList.remove('open');
});

// ============================================
// Helpers
// ============================================
function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(dt) {
    if (!dt) return '';
    const d = Date.now() - new Date(dt).getTime();
    if (d < 60000) return 'Just now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    return Math.floor(d / 86400000) + 'd ago';
}

function formatBytes(b) {
    if (!b) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}

function apiRequest(url, method = 'GET', data = null, signal = null) {
    const opt = { method, headers: { 'X-Requested-With': 'XMLHttpRequest' } };
    if (signal) opt.signal = signal;
    if (data && !(data instanceof FormData)) {
        opt.headers['Content-Type'] = 'application/json';
        opt.body = JSON.stringify(data);
    } else if (data) { opt.body = data; }
    const request = signal ? fetch(url, opt) : window.TaskFlowRuntime.timeoutFetch(`api:${method}:${url}`, url, opt, 15000);
    return request.then(r => {
        if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
        return r.json();
    });
}

// Global unhandled promise rejection logger
window.addEventListener('unhandledrejection', e => {
    if (e.reason?.name === 'AbortError') return; // Ignore intentional cancels
    console.warn('[TaskFlow] Unhandled promise rejection:', e.reason);
    window.TaskFlowRuntime.logClientError('unhandledrejection', e.reason);
});

window.addEventListener('error', e => {
    window.TaskFlowRuntime.logClientError('window.error', e.error || e.message, {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
    });
});

// ============================================
// Viewport height fix for mobile browsers
// ============================================
function setViewportHeight() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
setViewportHeight();
let viewportResizeRaf = 0;
window.addEventListener('resize', () => {
    if (viewportResizeRaf) cancelAnimationFrame(viewportResizeRaf);
    viewportResizeRaf = requestAnimationFrame(() => {
        viewportResizeRaf = 0;
        setViewportHeight();
    });
}, { passive: true });

// ============================================
// PWA install prompt
// ============================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
});

console.log('TaskFlow v2 loaded');
