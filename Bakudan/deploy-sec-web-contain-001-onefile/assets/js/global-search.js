/* =========================================================
   Command Palette — Ctrl/Cmd+K
   Searches pages, stores, bills, tasks, users, actions, AI
   ========================================================= */
(function () {
    'use strict';

    const BASE = (window.APP_URL || '').replace(/\/$/, '');
    let root, input, modeChip, bodyEl, activeIndex = -1, currentItems = [];
    let debounceTimer = null;
    let currentMode   = 'search';

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = (s == null) ? '' : String(s);
        return d.innerHTML;
    }

    // SVG icon inline helper (small set for palette)
    function icon(name, size) {
        size = size || 16;
        const paths = {
            'search'          : '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
            'overview'        : '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
            'check-square'    : '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
            'calendar'        : '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
            'clock'           : '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
            'credit-card'     : '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
            'wallet'          : '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
            'folder'          : '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
            'store'           : '<path d="M3 9l1-4h16l1 4"/><path d="M3 9v1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9"/><path d="M5 20h14a1 1 0 0 0 1-1v-6H4v6a1 1 0 0 0 1 1z"/>',
            'building'        : '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
            'users'           : '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
            'inbox'           : '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
            'shield'          : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
            'alert-triangle'  : '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
            'arrow-left-right': '<polyline points="17 2 21 6 17 10"/><path d="M3 6h18"/><polyline points="7 22 3 18 7 14"/><path d="M21 18H3"/>',
            'zap'             : '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
            'filter'          : '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
            'admin'           : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
            'brain'           : '<path d="M12 5a3 3 0 1 0-5.997.125A4 4 0 0 0 2 9.465a4 4 0 0 0 4 4.463v.043a3.96 3.96 0 0 0 4 4.032 3.96 3.96 0 0 0 4-4.032v-.043a4 4 0 0 0 4-4.463 4 4 0 0 0-4.003-4.34A3 3 0 0 0 12 5z"/>',
        };
        const p = paths[name] || paths['search'];
        return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    }

    function mount() {
        if (root) return;
        root = document.createElement('div');
        root.className = 'gs-overlay cmdk-overlay';
        root.innerHTML = `
            <div class="gs-backdrop" data-gs-close></div>
            <div class="gs-panel cmdk-panel" role="dialog" aria-modal="true" aria-label="Command Palette">
                <div class="gs-input-wrap cmdk-input-wrap">
                    <span class="cmdk-search-icon">${icon('search', 18)}</span>
                    <input id="gs-input" class="gs-input" type="text"
                           placeholder="Search, jump, or run an action…"
                           autocomplete="off" spellcheck="false">
                    <span id="cmdkModeChip" class="cmdk-mode-chip hidden"></span>
                    <button class="gs-close-btn" type="button" data-gs-close>Esc</button>
                </div>
                <div id="cmdkContext" class="cmdk-context">
                    Search pages, stores, bills, tasks, people, or actions
                </div>
                <div id="gs-body" class="gs-body cmdk-body"></div>
                <div class="gs-foot cmdk-foot">
                    <span><kbd>↵</kbd> Open</span>
                    <span><kbd>↑↓</kbd> Navigate</span>
                    <span><kbd>Esc</kbd> Close</span>
                    <span class="cmdk-foot-modes">
                        <kbd>&gt;</kbd> Actions &nbsp;
                        <kbd>?</kbd> AI
                    </span>
                </div>
            </div>
        `;
        document.body.appendChild(root);
        input    = root.querySelector('#gs-input');
        modeChip = root.querySelector('#cmdkModeChip');
        bodyEl   = root.querySelector('#gs-body');

        root.addEventListener('click', function(e) {
            if (e.target.matches('[data-gs-close]')) close();
        });
        input.addEventListener('input', onInput);
        input.addEventListener('keydown', onKeydown);
    }

    function open() {
        mount();
        root.classList.add('gs-open');
        document.body.style.overflow = 'hidden';
        setTimeout(function() { input.focus(); }, 10);
        showDefault();
    }

    function close() {
        if (!root) return;
        root.classList.remove('gs-open');
        document.body.style.overflow = '';
        input.value = '';
        activeIndex = -1; currentItems = [];
        currentMode = 'search';
        updateModeChip('search', '');
        bodyEl.innerHTML = '';
    }

    function showDefault() {
        activeIndex = -1; currentItems = [];
        fetch(BASE + '/api/command-palette?q=', { credentials: 'same-origin' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) { if (data) renderResults(data); })
            .catch(function() {});
    }

    function onInput() {
        const raw = input.value;
        const q   = raw.trim();
        clearTimeout(debounceTimer);
        activeIndex = -1; currentItems = [];

        // Detect mode prefix
        if (q.startsWith('>')) {
            updateModeChip('action', 'Actions');
        } else if (q.startsWith('?')) {
            updateModeChip('ai', 'AI');
        } else {
            updateModeChip('search', '');
        }

        if (!q || q === '>' || q === '?') {
            showDefault();
            return;
        }

        bodyEl.innerHTML = `<div class="gs-loading"><span class="gs-loading-dot"></span><span class="gs-loading-dot"></span><span class="gs-loading-dot"></span></div>`;
        debounceTimer = setTimeout(function() { runSearch(q); }, 200);
    }

    function updateModeChip(mode, label) {
        currentMode = mode;
        const ctx = root ? root.querySelector('#cmdkContext') : null;
        if (!modeChip) return;
        if (!label) {
            modeChip.classList.add('hidden');
            if (ctx) ctx.textContent = 'Search pages, stores, bills, tasks, people, or actions';
        } else if (mode === 'action') {
            modeChip.textContent = '> Actions';
            modeChip.className = 'cmdk-mode-chip cmdk-mode-action';
            if (ctx) ctx.textContent = 'Type an action: rebalance, pay, create, file…';
        } else if (mode === 'ai') {
            modeChip.textContent = '? AI';
            modeChip.className = 'cmdk-mode-chip cmdk-mode-ai';
            if (ctx) ctx.textContent = 'Ask: what is overdue · who is overloaded · what should I do next';
        }
    }

    function runSearch(q) {
        fetch(BASE + '/api/command-palette?q=' + encodeURIComponent(q), {
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(renderResults)
        .catch(function() {
            bodyEl.innerHTML = `<div class="gs-empty"><div class="gs-empty-icon">${icon('alert-triangle',28)}</div>Search failed. Try again.</div>`;
        });
    }

    // ── Render ──────────────────────────────────────────────────────

    function renderResults(data) {
        currentItems = [];
        let html = '';
        let hasAny = false;

        // 1. AI results (top if present)
        if (data.ai && data.ai.length) {
            hasAny = true;
            html += renderGroup('AI Insight', 'cmdk-grp-ai', data.ai.map(function(item) {
                currentItems.push({ url: item.url, kind: 'ai', action: item.action_label });
                return `
                <div class="gs-item cmdk-item cmdk-item-ai" data-gs-idx="${currentItems.length-1}" data-url="${esc(item.url)}">
                    <div class="cmdk-item-icon cmdk-icon-ai">${icon('brain',16)}</div>
                    <div class="gs-item-main">
                        <div class="gs-item-title">${esc(item.title)}</div>
                        <div class="gs-item-meta">${esc(item.subtitle)}</div>
                    </div>
                    <span class="cmdk-impact cmdk-impact-${(item.impact||'').toLowerCase()}">${esc(item.impact||'')}</span>
                    <span class="cmdk-cta">${esc(item.action_label||'Open')}</span>
                </div>`;
            }).join(''));
        }

        // 2. Actions
        if (data.actions && data.actions.length) {
            hasAny = true;
            html += renderGroup('Actions', 'cmdk-grp-actions', data.actions.map(function(a) {
                currentItems.push({ kind: 'action', action: a.action, url: a.url || null });
                return `
                <div class="gs-item cmdk-item cmdk-item-action" data-gs-idx="${currentItems.length-1}" data-action="${esc(a.action||'')}" data-url="${esc(a.url||'')}">
                    <div class="cmdk-item-icon cmdk-icon-action">${icon(a.icon||'zap',16)}</div>
                    <div class="gs-item-main">
                        <div class="gs-item-title">${esc(a.label)}</div>
                        <div class="gs-item-meta">${esc(a.subtitle)}</div>
                    </div>
                    <span class="gs-item-kbd">↵</span>
                </div>`;
            }).join(''));
        }

        // 3. Pages
        if (data.pages && data.pages.length) {
            hasAny = true;
            html += renderGroup('Pages', 'cmdk-grp-pages', data.pages.map(function(p) {
                currentItems.push({ url: p.url, kind: 'page' });
                return `
                <a class="gs-item cmdk-item" href="${BASE}${esc(p.url)}" data-gs-idx="${currentItems.length-1}">
                    <div class="cmdk-item-icon cmdk-icon-page">${icon(p.icon||'folder',16)}</div>
                    <div class="gs-item-main">
                        <div class="gs-item-title">${esc(p.label)}</div>
                        <div class="gs-item-meta">${esc(p.subtitle)}</div>
                    </div>
                    <span class="gs-item-kbd">↵</span>
                </a>`;
            }).join(''));
        }

        // 4. Stores
        if (data.stores && data.stores.length) {
            hasAny = true;
            html += renderGroup('Stores', 'cmdk-grp-stores', data.stores.map(function(s) {
                currentItems.push({ url: s.url, kind: 'store' });
                const badge = s.overdue_tasks > 0 ? `<span class="cmdk-badge-crit">${s.overdue_tasks} overdue</span>` : '';
                return `
                <a class="gs-item cmdk-item" href="${BASE}${esc(s.url)}" data-gs-idx="${currentItems.length-1}">
                    <div class="cmdk-item-icon" style="background:${esc(s.color||'#f59e0b')};color:#111">${icon('store',14)}</div>
                    <div class="gs-item-main">
                        <div class="gs-item-title">${esc(s.name)} ${badge}</div>
                        <div class="gs-item-meta">Store</div>
                    </div>
                    <span class="gs-item-kbd">↵</span>
                </a>`;
            }).join(''));
        }

        // 5. Bills
        if (data.bills && data.bills.length) {
            hasAny = true;
            html += renderGroup('Bills', 'cmdk-grp-bills', data.bills.map(function(b) {
                currentItems.push({ url: b.url || '/bills', kind: 'bill' });
                const chips = [];
                if (b.is_overdue) chips.push(`<span class="gs-item-chip gs-overdue">${b.days_over}d overdue</span>`);
                else if (b.is_today) chips.push('<span class="gs-item-chip gs-today">Due today</span>');
                return `
                <a class="gs-item cmdk-item" href="${BASE}/bills" data-gs-idx="${currentItems.length-1}">
                    <div class="cmdk-item-icon cmdk-icon-bill">${icon('credit-card',14)}</div>
                    <div class="gs-item-main">
                        <div class="gs-item-title">${esc(b.title)} ${chips.join('')}</div>
                        <div class="gs-item-meta">${b.vendor ? esc(b.vendor)+' · ' : ''}$${b.amount.toLocaleString()} · ${esc(b.store_name)}</div>
                    </div>
                    <span class="gs-item-kbd">↵</span>
                </a>`;
            }).join(''));
        }

        // 6. Tasks
        if (data.tasks && data.tasks.length) {
            hasAny = true;
            html += renderGroup('Tasks', 'cmdk-grp-tasks', data.tasks.map(function(t) {
                currentItems.push({ url: t.url, kind: 'task', taskId: t.id });
                const chips = [];
                if (t.is_overdue) chips.push('<span class="gs-item-chip gs-overdue">overdue</span>');
                if (t.is_completed) chips.push('<span class="gs-item-chip gs-done">done</span>');
                if (t.is_recurring) chips.push('<span class="gs-item-chip gs-rec">recurring</span>');
                const meta = [];
                if (t.project_name) meta.push(esc(t.project_name));
                if (t.store_name) meta.push(esc(t.store_name));
                if (t.assignee_name) meta.push(esc(t.assignee_name));
                return `
                <a class="gs-item cmdk-item ${t.is_completed ? 'gs-completed' : ''}" href="${BASE}${esc(t.url)}" data-gs-idx="${currentItems.length-1}" data-gs-task-id="${t.id}">
                    <div class="cmdk-item-icon" style="background:${esc(t.project_color||'#6366f1')}">${icon('check-square',13)}</div>
                    <div class="gs-item-main">
                        <div class="gs-item-title">${esc(t.title)}</div>
                        <div class="gs-item-meta">${chips.join('')}${chips.length&&meta.length?' ':''}${meta.join(' · ')}</div>
                    </div>
                    <span class="gs-item-kbd">↵</span>
                </a>`;
            }).join(''));
        }

        // 7. Users
        if (data.users && data.users.length) {
            hasAny = true;
            html += renderGroup('People', 'cmdk-grp-users', data.users.map(function(u) {
                currentItems.push({ url: u.url, kind: 'user' });
                const initial = (u.name || '?')[0].toUpperCase();
                const overloadBadge = u.is_overloaded ? '<span class="cmdk-badge-crit">Overloaded</span>' : '';
                return `
                <a class="gs-item cmdk-item" href="${BASE}${esc(u.url)}" data-gs-idx="${currentItems.length-1}">
                    <div class="cmdk-item-icon" style="background:#22c55e;color:#fff;font-weight:700;font-size:12px">${esc(initial)}</div>
                    <div class="gs-item-main">
                        <div class="gs-item-title">${esc(u.name)} ${overloadBadge}</div>
                        <div class="gs-item-meta">${esc(u.role)} · ${u.open_tasks} open tasks</div>
                    </div>
                    <span class="gs-item-kbd">↵</span>
                </a>`;
            }).join(''));
        }

        if (!hasAny) {
            bodyEl.innerHTML = `<div class="gs-empty"><div class="gs-empty-icon">${icon('search',32)}</div>No results for "<b>${esc(data.query||'')}</b>"</div>`;
            return;
        }

        bodyEl.innerHTML = html;
        activeIndex = 0;
        highlight();

        // Attach events
        bodyEl.querySelectorAll('.gs-item, .cmdk-item').forEach(function(el) {
            el.addEventListener('mouseenter', function() { activeIndex = +el.dataset.gsIdx; highlight(); });
            el.addEventListener('click', function(ev) { handleItemClick(ev, el); });
        });
    }

    function renderGroup(title, cls, rowsHtml) {
        return `<div class="gs-group ${cls}">
            <div class="gs-group-head">${title}</div>
            ${rowsHtml}
        </div>`;
    }

    function handleItemClick(ev, el) {
        const action = el.dataset.action;
        const url    = el.dataset.url;
        const taskId = el.dataset.gsTaskId;

        if (action === 'open-create-task') {
            ev.preventDefault();
            close();
            if (typeof openCreateTaskModal === 'function') openCreateTaskModal();
            return;
        }
        if (action === 'navigate' && url) {
            ev.preventDefault();
            close();
            window.location.href = BASE + url;
            return;
        }
        if (taskId && window.TaskDrawer && typeof window.TaskDrawer.focusTask === 'function') {
            ev.preventDefault();
            close();
            try { window.TaskDrawer.focusTask(taskId); } catch(e) { /* fall through to URL */ }
            return;
        }
        // Default: navigate to href if present, then close palette
        if (el.tagName === 'A' && el.href) {
            ev.preventDefault();
            close();
            window.location.href = el.href;
            return;
        }
        close();
    }

    function highlight() {
        bodyEl.querySelectorAll('.gs-item, .cmdk-item').forEach(function(el, i) {
            el.classList.toggle('gs-active', i === activeIndex);
            el.classList.toggle('cmdk-active', i === activeIndex);
        });
        const active = bodyEl.querySelector('.gs-active, .cmdk-active');
        if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function executeActive() {
        if (activeIndex < 0 || !currentItems[activeIndex]) return;
        const item = currentItems[activeIndex];
        const el   = bodyEl.querySelector(`[data-gs-idx="${activeIndex}"]`);
        if (el) { handleItemClick(new Event('click'), el); return; }
        if (item.url) window.location.href = BASE + item.url;
    }

    function onKeydown(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const els = bodyEl.querySelectorAll('.gs-item, .cmdk-item');
            if (els.length) { activeIndex = (activeIndex + 1) % els.length; highlight(); }
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const els = bodyEl.querySelectorAll('.gs-item, .cmdk-item');
            if (els.length) { activeIndex = (activeIndex - 1 + els.length) % els.length; highlight(); }
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            executeActive();
        }
    }

    // ── Global shortcuts ────────────────────────────────────────────

    document.addEventListener('keydown', function(e) {
        const isK = (e.key || '').toLowerCase() === 'k';
        if (isK && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (root && root.classList.contains('gs-open')) { close(); } else { open(); }
        }
    });

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-gs-trigger]')) {
            e.preventDefault();
            open();
        }
    });

    window.GlobalSearch = { open, close };
    window.CommandPalette = { open, close };
})();
