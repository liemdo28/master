/* ============================================
   Layout – Create Dropdown & Task Modal
   ============================================ */

// Create New Dropdown
function closeCreateDropdown() {
    var dropdown = document.getElementById('createNewDropdown');
    if (dropdown) dropdown.classList.remove('open');
}

document.addEventListener('click', function(e) {
    // Close create-new dropdown when clicking outside
    const wrap = document.querySelector('.create-new-wrap');
    if (wrap && !wrap.contains(e.target)) closeCreateDropdown();

    // Data-action event delegation
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
        case 'toggle-create-dropdown':
            var dropdown = document.getElementById('createNewDropdown');
            if (dropdown) dropdown.classList.toggle('open');
            e.stopPropagation();
            break;

        case 'open-create-task':
            e.preventDefault();
            openCreateTaskModal();
            closeCreateDropdown();
            break;

        case 'close-create-dropdown':
            closeCreateDropdown();
            break;

        case 'close-create-task':
            closeCreateTaskModal();
            break;

        case 'toggle-sidebar':
            if (typeof toggleSidebar === 'function') toggleSidebar();
            break;

        case 'toggle-notif':
            if (typeof toggleNotifDropdown === 'function') toggleNotifDropdown();
            break;

        case 'mark-notif-read':
            if (typeof markAllNotifRead === 'function') markAllNotifRead();
            break;

        case 'close-sidebar':
            if (typeof closeSidebar === 'function') closeSidebar();
            break;

        case 'select-urgency':
            selectUrgency(el, el.dataset.urgency);
            break;
    }
});

// Create Task Modal
function openCreateTaskModal() {
    var modal = document.getElementById('createTaskModal');
    if (!modal) return;
    modal.classList.add('open');
    setTimeout(function() {
        var inp = document.querySelector('#quickTaskForm input[name="title"]');
        if (inp) inp.focus();
    }, 250);
}

function closeCreateTaskModal() {
    var modal = document.getElementById('createTaskModal');
    if (modal) modal.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('createTaskModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeCreateTaskModal();
        });
    }

    // Quick task form: sync urgency → priority on submit
    var form = document.getElementById('quickTaskForm');
    if (form) {
        form.addEventListener('submit', function() {
            var urgencyInput = this.querySelector('input[name="urgency"]:checked');
            if (urgencyInput && urgencyInput.value === 'urgent') {
                var pSel = this.querySelector('select[name="priority"]');
                if (pSel) pSel.value = 'urgent';
            }
        });
    }
});

// Urgency selector
function selectUrgency(el, val) {
    document.querySelectorAll('.urgency-option').forEach(function(o) {
        o.classList.remove('selected');
    });
    el.classList.add('selected');
    var input = el.querySelector('input');
    if (input) input.checked = true;
    if (val === 'urgent') {
        var pSel = document.querySelector('#quickTaskForm select[name="priority"]');
        if (pSel) pSel.value = 'urgent';
    }
}

/* ============================================================
   Sidebar v2 — System Group Collapse + Live Badge Refresh
   ============================================================ */

// System section collapse
document.addEventListener('DOMContentLoaded', function() {
    var toggle = document.getElementById('sbSystemToggle');
    var items  = document.getElementById('sbSystemItems');
    if (toggle && items) {
        toggle.addEventListener('click', function() {
            var collapsed = items.classList.toggle('hidden');
            toggle.classList.toggle('collapsed', collapsed);
        });
    }
});

// Live badge refresh — fetch counts every 90s
(function sbBadgePoller() {
    var failureCount = 0;
    var retryTimer = null;

    function refreshBadges() {
        if (document.hidden || !window.APP_URL) return Promise.resolve();
        var runtime = window.TaskFlowRuntime;
        var request = runtime
            ? runtime.timeoutFetch('sidebar.badges', window.APP_URL + '/api/sidebar/badges', {
                headers: { 'X-CSRF-Token': window.CSRF_TOKEN || '', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin'
            }, 10000)
            : fetch(window.APP_URL + '/api/sidebar/badges', {
            headers: { 'X-CSRF-Token': window.CSRF_TOKEN || '', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin'
            });

        return request
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
            if (!data) return;
            failureCount = 0;
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            var map = {
                '[data-sb-key="priority"]':  data.priority,
                '[data-sb-key="overdue"]':   data.overdue,
                '[data-sb-key="today"]':     data.today,
                '[data-sb-key="payments"]':  data.payments,
                '[data-sb-key="filings"]':   data.filings,
                '[data-sb-key="inbox"]':     data.inbox
            };
            Object.keys(map).forEach(function(sel) {
                var el = document.querySelector(sel);
                if (!el) return;
                var n = parseInt(map[sel]) || 0;
                if (n > 0) {
                    el.textContent = n > 99 ? '99+' : n;
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });
        })
        .catch(function(err) {
            if (err && err.name === 'AbortError') return;
            failureCount += 1;
            if (runtime) runtime.logClientError('sidebar.badges', err || 'Failed to refresh sidebar badges', { failures: failureCount });
            if (!retryTimer) {
                retryTimer = setTimeout(function() {
                    retryTimer = null;
                    refreshBadges();
                }, Math.min(60000, 3000 * Math.pow(2, Math.min(failureCount, 5))));
            }
        });
    }
    if (!window._sbBadgePollerStarted) {
        window._sbBadgePollerStarted = true;
        if (window.TaskFlowRuntime) {
            window.TaskFlowRuntime.scheduleVisibleInterval(refreshBadges, 90000);
        } else {
            setInterval(refreshBadges, 90000);
        }
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) refreshBadges();
        });
    }
})();
