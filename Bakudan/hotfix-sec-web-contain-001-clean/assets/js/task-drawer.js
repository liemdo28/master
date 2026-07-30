/* =========================================================
   Task Drawer — professional day/task detail drawer
   Usage:
       window.TaskDrawer.open('2026-04-14');
       window.TaskDrawer.open('2026-04-14', { projectId: 4 });
   Trigger via click:
       <any data-td-open data-td-date="2026-04-14" [data-td-project="4"]>
   Relies on:
       - window.APP_URL + window.CSRF_TOKEN globals (set in layout)
       - Session-auth endpoints:
           GET  /api/calendar/day/YYYY-MM-DD[?project_id=N]
           GET  /api/users/assignable
           POST /api/tasks/{id}/{complete|snooze|move-date|reassign|status|priority}
   ========================================================= */
(function () {
    'use strict';

    const BASE = (window.APP_URL || (typeof APP_URL !== 'undefined' ? APP_URL : '')).replace(/\/$/, '');
    const getCsrf = () => (window.CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || '');
    const APP_TODAY = () => (window.APP_TODAY || new Date().toLocaleDateString('en-CA'));

    let root, bodyEl, titleEl, subEl, footEl, prevBtn, nextBtn;
    let currentState = { date: null, projectId: null, tasks: [], activeTaskIdx: -1 };
    let userCache = null;
    let _fetchController = null; // AbortController for in-flight fetch

    function esc(s) {
        const d = document.createElement('div'); d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }
    function addDays(ymd, n) {
        const [y, m, d] = ymd.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() + n);
        return dt.toISOString().slice(0, 10);
    }

    function ensureMounted() {
        if (root) return;
        root = document.createElement('div');
        root.className = 'td-root';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <div class="td-backdrop" data-td-close></div>
            <aside class="td-panel" role="dialog" aria-modal="true" aria-labelledby="td-title">
                <header class="td-head">
                    <button class="td-nav-btn" id="td-prev" type="button" aria-label="Previous day">‹</button>
                    <div style="flex:1;min-width:0">
                        <h3 id="td-title" class="td-head-title">—</h3>
                        <div id="td-sub" class="td-head-sub"></div>
                    </div>
                    <button class="td-nav-btn" id="td-next" type="button" aria-label="Next day">›</button>
                    <button class="td-close" type="button" data-td-close aria-label="Close">✕</button>
                </header>
                <div id="td-body" class="td-body"><div class="td-skeleton"></div><div class="td-skeleton"></div></div>
                <footer id="td-foot" class="td-foot" hidden></footer>
            </aside>
            <div class="td-toast-wrap" id="td-toasts"></div>
        `;
        document.body.appendChild(root);
        bodyEl = root.querySelector('#td-body');
        titleEl = root.querySelector('#td-title');
        subEl = root.querySelector('#td-sub');
        footEl = root.querySelector('#td-foot');
        prevBtn = root.querySelector('#td-prev');
        nextBtn = root.querySelector('#td-next');

        root.addEventListener('click', (e) => {
            if (e.target.matches('[data-td-close]')) close();
        });
        prevBtn.addEventListener('click', () => navigateDay(-1));
        nextBtn.addEventListener('click', () => navigateDay(1));
        document.addEventListener('keydown', onKey);
    }

    function onKey(e) {
        if (!root || !root.classList.contains('td-open')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateDay(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); navigateDay(+1); }
        else if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); focusTask(+1); }
        else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); focusTask(-1); }
    }

    function navigateDay(delta) {
        if (!currentState.date) return;
        const newDate = addDays(currentState.date, delta);
        open(newDate, { projectId: currentState.projectId });
    }

    function focusTask(delta) {
        const cards = bodyEl.querySelectorAll('.td-task');
        if (!cards.length) return;
        let idx = currentState.activeTaskIdx;
        idx = Math.max(0, Math.min(cards.length - 1, idx + delta));
        currentState.activeTaskIdx = idx;
        cards.forEach((c, i) => c.classList.toggle('td-focus', i === idx));
        const active = cards[idx];
        if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // ── Toasts ----------------------------------------------------
    function toast(msg, type) {
        const wrap = document.getElementById('td-toasts');
        if (!wrap) return;
        const el = document.createElement('div');
        el.className = 'td-toast' + (type === 'error' ? ' td-toast-error' : type === 'info' ? ' td-toast-info' : '');
        el.style.pointerEvents = 'auto';
        el.textContent = msg;
        wrap.appendChild(el);
        setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, 2600);
        setTimeout(() => el.remove(), 3000);
    }

    function toastReviewRequired(taskId) {
        const wrap = document.getElementById('td-toasts');
        if (!wrap) return;
        const el = document.createElement('div');
        el.className = 'td-toast td-toast-error';
        el.style.pointerEvents = 'auto';
        el.innerHTML = '🔍 Task này có reviewer — cần submit để review trước.<br>'
            + '<a href="' + (window.APP_URL || '') + '/tasks/' + taskId + '" '
            + 'style="color:#fff;font-weight:700;text-decoration:underline;margin-top:4px;display:inline-block">'
            + '→ Mở task để submit</a>';
        wrap.appendChild(el);
        setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, 5000);
        setTimeout(() => el.remove(), 5400);
    }

    // ── Open / close ---------------------------------------------
    function open(date, opts = {}) {
        ensureMounted();
        currentState = { date, projectId: opts.projectId || currentState.projectId || null, tasks: [], activeTaskIdx: -1 };
        root.classList.add('td-open');
        root.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        titleEl.textContent = formatDate(date);
        subEl.innerHTML = '<span>Loading…</span>';
        bodyEl.innerHTML = '<div class="td-skeleton"></div><div class="td-skeleton"></div><div class="td-skeleton"></div>';
        footEl.hidden = true;
        // Cancel any in-flight request before starting a new one (prevent stale render)
        if (_fetchController) { _fetchController.abort(); }
        _fetchController = new AbortController();
        const signal = _fetchController.signal;
        // Pre-fetch user list (once per session)
        if (!userCache) fetchUsers();
        fetchDay(date, currentState.projectId, signal).then(render).catch(err => {
            if (err.name === 'AbortError') return; // Stale request, ignore
            bodyEl.innerHTML = `<div class="td-empty"><div class="td-empty-icon">⚠️</div>Không tải được: ${esc(err.message || 'unknown')}</div>`;
        });
    }

    function close() {
        if (!root) return;
        root.classList.remove('td-open');
        root.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function formatDate(d) {
        const [y, m, day] = d.split('-').map(Number);
        const dt = new Date(y, m - 1, day);
        return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // ── Fetch -----------------------------------------------------
    function fetchDay(date, projectId, signal) {
        let url = BASE + '/api/calendar/day/' + encodeURIComponent(date);
        if (projectId) url += '?project_id=' + encodeURIComponent(projectId);
        return fetch(url, { credentials: 'same-origin', signal, headers: { 'Accept': 'application/json' } })
            .then(async r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    function fetchUsers() {
        return fetch(BASE + '/api/users/assignable', { credentials: 'same-origin' })
            .then(r => r.ok ? r.json() : { users: [] })
            .then(j => { userCache = j.users || []; return userCache; })
            .catch(() => { userCache = []; return userCache; });
    }
    function post(path, body) {
        const form = new URLSearchParams(body || {});
        form.append('csrf_token', getCsrf());
        return fetch(BASE + path, {
            method: 'POST', credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRF-Token': getCsrf(),
                'Accept': 'application/json'
            },
            body: form.toString()
        }).then(async r => {
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
            return j;
        });
    }

    // ── Render ----------------------------------------------------
    function render(data) {
        // FIX: Defensive null safety for data payload
        const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
        currentState.tasks = tasks;
        currentState.activeTaskIdx = tasks.length ? 0 : -1;

        // sub header
        const badges = [];
        if (data.is_today) badges.push('<span class="td-tag td-today">Hôm nay</span>');
        if (data.is_overdue) badges.push('<span class="td-tag td-overdue">Quá hạn</span>');
        if (data.is_future) badges.push('<span class="td-tag td-future">Tương lai</span>');
        subEl.innerHTML = `<span>${tasks.length} task${tasks.length === 1 ? '' : 's'}</span>${badges.join('')}`;

        if (!tasks.length) {
            bodyEl.innerHTML = `<div class="td-empty"><div class="td-empty-icon">📅</div>Không có task nào cho ngày này.<br><span style="opacity:.5;font-size:11px">← → chuyển ngày · Esc đóng</span></div>`;
            footEl.hidden = true;
            return;
        }

        bodyEl.innerHTML = tasks.map(renderTask).join('');
        bindActions();
        // Mark first task as focused for keyboard nav
        const firstCard = bodyEl.querySelector('.td-task');
        if (firstCard) firstCard.classList.add('td-focus');

        // footer stats
        const completed = tasks.filter(t => t.is_completed).length;
        const overdue = tasks.filter(t => t.badge === 'overdue').length;
        const recurring = tasks.filter(t => t.is_recurring).length;
        footEl.innerHTML = `
            <div class="td-foot-stats">
                <span><b>${completed}</b>/${tasks.length} done</span>
                ${overdue ? `<span>• <b>${overdue}</b> overdue</span>` : ''}
                ${recurring ? `<span>• <b>${recurring}</b> recurring</span>` : ''}
            </div>
            <div style="opacity:.6">← → day · ↑↓ task · Esc close</div>
        `;
        footEl.hidden = false;
    }

    function renderTask(t) {
        const chips = [];
        if (t.badge === 'overdue') chips.push('<span class="td-chip td-c-overdue">! Quá hạn</span>');
        if (t.badge === 'today') chips.push('<span class="td-chip td-c-today">● Hôm nay</span>');
        if (t.is_recurring) chips.push(`<span class="td-chip td-c-recurring">↻ ${esc(t.recurrence_label || t.repeat_type)}</span>`);

        const metaParts = [];
        if (t.store_name) metaParts.push(`<span class="td-meta-item">${t.store_color ? `<span class="td-dot" style="background:${esc(t.store_color)}"></span>` : '🏪'} ${esc(t.store_name)}</span>`);
        if (t.project_name) metaParts.push(`<span class="td-meta-item">${t.project_color ? `<span class="td-dot" style="background:${esc(t.project_color)}"></span>` : '📁'} ${esc(t.project_name)}</span>`);
        if (t.section_name) metaParts.push(`<span class="td-meta-item">📍 ${esc(t.section_name)}</span>`);

        // Inline editors
        const statusLabel = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
        const priLabel = { urgent: 'Gấp', high: 'High', medium: 'Medium', low: 'Low' };
        const assigneeBlock = t.is_completed ? '' : `
            <div class="td-inline-edit">
                <label>Giao cho</label>
                <select class="td-select" data-inline="assignee" data-id="${t.id}">
                    <option value="">— Chưa giao —</option>
                </select>
            </div>`;
        const statusBlock = t.is_completed ? '' : `
            <div class="td-inline-edit">
                <label>Trạng thái</label>
                <div class="td-pillgroup" data-inline="status" data-id="${t.id}">
                    ${['todo', 'in_progress', 'review', 'done'].map(s =>
            `<button type="button" class="td-pill ${t.status === s ? 'td-pill-active' : ''}" data-value="${s}">${esc(statusLabel[s])}</button>`
        ).join('')}
                </div>
            </div>`;
        const priorityBlock = t.is_completed ? '' : `
            <div class="td-inline-edit">
                <label>Độ ưu tiên</label>
                <div class="td-pillgroup" data-inline="priority" data-id="${t.id}">
                    ${['low', 'medium', 'high', 'urgent'].map(p =>
            `<button type="button" class="td-pill td-pill-pri-${p} ${t.priority === p ? 'td-pill-active' : ''}" data-value="${p}">${esc(priLabel[p])}</button>`
        ).join('')}
                </div>
            </div>`;

        const actions = t.is_completed
            ? `<span class="td-done-chip">✓ Đã hoàn thành</span>
               <button class="td-btn" data-act="reopen" data-id="${t.id}">↺ Mở lại</button>`
            : `
                <button class="td-btn td-primary" data-act="complete" data-id="${t.id}">✓ Complete</button>
                <button class="td-btn" data-act="snooze" data-id="${t.id}" data-days="1">+1d</button>
                <button class="td-btn" data-act="snooze" data-id="${t.id}" data-days="7">+7d</button>
                <button class="td-btn" data-act="move" data-id="${t.id}">📅 Move</button>
                <button class="td-btn" data-act="toggle-edit" data-id="${t.id}">✎ Chỉnh</button>
            `;

        return `
            <article class="td-task ${t.is_completed ? 'td-completed' : ''}" data-task-id="${t.id}" data-assignee-id="${t.assignee_id || ''}" data-repeat="${t.repeat_type || 'none'}">
                <div class="td-task-top">
                    ${t.is_completed
                ? `<div class="td-check td-done" title="Completed">✓</div>`
                : `<button class="td-check" data-act="complete" data-id="${t.id}" title="Mark complete"></button>`}
                    <div class="td-task-title" data-td-title-wrap>
                        <a href="${BASE}/tasks/${t.id}" data-td-title-text>${esc(t.title)}</a>
                        ${t.is_completed ? '' : `<button class="td-title-edit" data-act="edit-title" data-id="${t.id}" title="Edit title">✎</button>`}
                    </div>
                </div>
                <div class="td-chips">${chips.join('')}</div>
                <div class="td-meta">
                    ${metaParts.join('')}
                    <span class="td-meta-item" data-assignee-display>${t.assignee_name
                ? '👤 ' + esc(t.assignee_name)
                : '<span style="opacity:.6">👤 Chưa giao</span>'}</span>
                </div>
                <div class="td-inline-edits" data-inline-panel style="display:none">
                    ${assigneeBlock}
                    ${statusBlock}
                    ${priorityBlock}
                </div>
                <div class="td-actions">
                    ${actions}
                    <button class="td-btn" data-act="toggle-comments" data-id="${t.id}">💬 Bình luận</button>
                    <button class="td-btn" data-act="toggle-subtasks" data-id="${t.id}">📋 Subtasks</button>
                    ${t.is_recurring ? `<button class="td-btn" data-act="recurrence" data-id="${t.id}">↻ Lịch</button>` : ''}
                    <a class="td-btn" href="${BASE}/tasks/${t.id}">Open →</a>
                </div>
                <div class="td-extra" data-extra-panel style="display:none"></div>
            </article>
        `;
    }

    // ── Actions ---------------------------------------------------
    function bindActions() {
        bodyEl.querySelectorAll('[data-act]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                handleAction(btn);
            });
        });
        // Inline pill groups (status / priority)
        bodyEl.querySelectorAll('[data-inline="status"] .td-pill, [data-inline="priority"] .td-pill').forEach(pill => {
            pill.addEventListener('click', () => handleInlinePill(pill));
        });
        // Assignee dropdowns — populate from userCache on-demand
        bodyEl.querySelectorAll('[data-inline="assignee"]').forEach(sel => {
            const card = sel.closest('.td-task');
            const currentAid = card?.dataset.assigneeId || '';
            const users = userCache || [];
            sel.innerHTML = '<option value="">— Chưa giao —</option>' +
                users.map(u => `<option value="${u.id}" ${String(u.id) === String(currentAid) ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
            sel.addEventListener('change', () => handleReassign(sel));
        });
        // Focus tracking on mouse hover for keyboard continuity
        bodyEl.querySelectorAll('.td-task').forEach((card, idx) => {
            card.addEventListener('mouseenter', () => {
                bodyEl.querySelectorAll('.td-task.td-focus').forEach(c => c.classList.remove('td-focus'));
                card.classList.add('td-focus');
                currentState.activeTaskIdx = idx;
            });
        });
    }

    function updatingStart(card) { if (card) card.classList.add('td-updating'); }
    function updatingEnd(card) { if (card) card.classList.remove('td-updating'); }

    function handleAction(btn) {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        const card = btn.closest('.td-task');
        updatingStart(card);

        const reloadDay = () => open(currentState.date, { projectId: currentState.projectId });
        const fail = (e) => { updatingEnd(card); toast(e.message || 'Lỗi', 'error'); };

        if (act === 'complete' || act === 'reopen') {
            post(`/api/tasks/${id}/complete`)
                .then(r => {
                    const msg = r.result && r.result.next_task_id
                        ? '✓ Hoàn thành — đã tạo occurrence kế tiếp'
                        : (act === 'reopen' ? '↺ Đã mở lại task' : '✓ Task completed');
                    toast(msg);
                    reloadDay();
                })
                .catch(err => {
                    if (err.message === 'needs_review') {
                        toastReviewRequired(id);
                    } else {
                        fail(err);
                    }
                });
        }
        else if (act === 'snooze') {
            const days = btn.dataset.days || '1';
            post(`/api/tasks/${id}/snooze`, { days })
                .then(r => { toast(`⏰ Dời ${days} ngày → ${r.due_date}`); reloadDay(); })
                .catch(fail);
        }
        else if (act === 'move') {
            showDatePrompt(currentState.date).then(newDate => {
                if (!newDate || newDate === currentState.date) { updatingEnd(card); return; }
                post(`/api/tasks/${id}/move-date`, { due_date: newDate })
                    .then(() => { toast(`📅 Chuyển sang ${newDate}`); reloadDay(); })
                    .catch(fail);
            });
        }
        else if (act === 'toggle-edit') {
            updatingEnd(card);
            const panel = card.querySelector('[data-inline-panel]');
            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
        // TKT-205 · comments
        else if (act === 'toggle-comments') {
            updatingEnd(card);
            renderExtra(card, 'comments', id);
        }
        // TKT-206 · subtasks
        else if (act === 'toggle-subtasks') {
            updatingEnd(card);
            renderExtra(card, 'subtasks', id);
        }
        // TKT-208 · recurrence inspector
        else if (act === 'recurrence') {
            updatingEnd(card);
            renderExtra(card, 'recurrence', id);
        }
        // TKT-202 · inline title edit
        else if (act === 'edit-title') {
            updatingEnd(card);
            startTitleEdit(card, id);
        }
    }

    // ── Extra panel renderer (comments / subtasks / recurrence) ──
    function renderExtra(card, kind, id) {
        const panel = card.querySelector('[data-extra-panel]');
        if (!panel) return;
        // Toggle close if same kind already open
        if (panel.dataset.kind === kind && panel.style.display !== 'none') {
            panel.style.display = 'none'; panel.dataset.kind = '';
            return;
        }
        panel.dataset.kind = kind;
        panel.style.display = 'block';
        panel.innerHTML = '<div class="td-extra-loading">Loading…</div>';
        if (kind === 'comments') loadComments(panel, id);
        else if (kind === 'subtasks') loadSubtasks(panel, id);
        else if (kind === 'recurrence') loadRecurrence(panel, id);
    }

    function loadComments(panel, id) {
        fetch(BASE + '/api/tasks/' + id + '/comments', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => {
                const cs = data.comments || [];
                panel.innerHTML = `
                    <div class="td-extra-head">💬 Bình luận (${cs.length})</div>
                    <div class="td-comment-list">
                        ${cs.length ? cs.map(c => `
                            <div class="td-comment">
                                <div class="td-comment-avatar">${esc((c.user_name || '?')[0].toUpperCase())}</div>
                                <div class="td-comment-body">
                                    <div class="td-comment-head"><b>${esc(c.user_name)}</b><span class="td-comment-time">${esc(c.created_at || '')}</span></div>
                                    <div class="td-comment-text">${esc(c.content)}</div>
                                </div>
                            </div>`).join('') : '<div class="td-extra-empty">Chưa có bình luận nào.</div>'}
                    </div>
                    <form class="td-comment-form" data-id="${id}">
                        <textarea placeholder="Viết bình luận…" rows="2" required></textarea>
                        <button type="submit" class="td-btn td-primary">Gửi</button>
                    </form>`;
                const form = panel.querySelector('.td-comment-form');
                form.addEventListener('submit', (ev) => {
                    ev.preventDefault();
                    const ta = form.querySelector('textarea');
                    const text = ta.value.trim();
                    if (!text) return;
                    post('/api/tasks/' + id + '/comments', { content: text })
                        .then(() => { toast('✓ Bình luận đã gửi'); loadComments(panel, id); })
                        .catch(e => toast(e.message || 'Lỗi', 'error'));
                });
            })
            .catch(e => { panel.innerHTML = `<div class="td-extra-empty">Lỗi: ${esc(e.message)}</div>`; });
    }

    function loadSubtasks(panel, id) {
        fetch(BASE + '/api/tasks/' + id + '/subtasks', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => {
                const st = data.subtasks || [];
                panel.innerHTML = `
                    <div class="td-extra-head">📋 Subtasks (${data.completed}/${data.count})</div>
                    ${st.length ? `
                        <div class="td-subtask-list">
                            ${st.map(s => `
                                <div class="td-subtask ${s.is_completed ? 'td-subtask-done' : ''}" data-sub-id="${s.id}">
                                    <button class="td-check-sm" data-sub-complete="${s.id}" ${s.is_completed ? 'disabled' : ''}>${s.is_completed ? '✓' : ''}</button>
                                    <span class="td-subtask-title">${esc(s.title)}</span>
                                    ${s.due_date ? `<span class="td-subtask-due">${esc(s.due_date)}</span>` : ''}
                                </div>`).join('')}
                        </div>` : '<div class="td-extra-empty">Chưa có subtask nào.</div>'}
                `;
                panel.querySelectorAll('[data-sub-complete]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const sid = btn.dataset.subComplete;
                        btn.disabled = true; btn.textContent = '…';
                        post('/api/tasks/' + sid + '/complete')
                            .then(() => loadSubtasks(panel, id))
                            .catch(e => { btn.disabled = false; btn.textContent = ''; toast(e.message, 'error'); });
                    });
                });
            })
            .catch(e => { panel.innerHTML = `<div class="td-extra-empty">Lỗi: ${esc(e.message)}</div>`; });
    }

    function loadRecurrence(panel, id) {
        fetch(BASE + '/api/tasks/' + id + '/recurrence-preview', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => {
                const next = data.next_occurrences || [];
                panel.innerHTML = `
                    <div class="td-extra-head">↻ 5 lần lặp kế tiếp (${esc(data.repeat_type)})</div>
                    ${next.length ? `
                        <ul class="td-rec-list">${next.map((d, i) => `
                            <li><span class="td-rec-idx">#${i + 1}</span><span>${esc(d)}</span></li>
                        `).join('')}</ul>` : '<div class="td-extra-empty">Không có occurrence kế tiếp (đã đạt end rule).</div>'}
                `;
            })
            .catch(e => { panel.innerHTML = `<div class="td-extra-empty">Lỗi: ${esc(e.message)}</div>`; });
    }

    function startTitleEdit(card, id) {
        const wrap = card.querySelector('[data-td-title-wrap]');
        const textEl = card.querySelector('[data-td-title-text]');
        if (!wrap || !textEl) return;
        const original = textEl.textContent;
        const input = document.createElement('input');
        input.type = 'text'; input.value = original; input.className = 'td-title-input';
        wrap.innerHTML = '';
        wrap.appendChild(input);
        input.focus(); input.select();
        const cancel = () => { wrap.innerHTML = `<a href="${BASE}/tasks/${id}" data-td-title-text>${esc(original)}</a><button class="td-title-edit" data-act="edit-title" data-id="${id}">✎</button>`; bindTitleEdit(card, id); };
        const save = () => {
            const val = input.value.trim();
            if (!val || val === original) return cancel();
            post('/api/tasks/' + id + '/title', { title: val })
                .then(() => { textEl.textContent = val; toast('✓ Đã cập nhật'); wrap.innerHTML = `<a href="${BASE}/tasks/${id}" data-td-title-text>${esc(val)}</a><button class="td-title-edit" data-act="edit-title" data-id="${id}">✎</button>`; bindTitleEdit(card, id); })
                .catch(e => { toast(e.message || 'Lỗi', 'error'); cancel(); });
        };
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        });
        input.addEventListener('blur', save);
    }

    function bindTitleEdit(card, id) {
        const btn = card.querySelector('[data-act="edit-title"]');
        if (btn) btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); startTitleEdit(card, id); });
    }

    function handleInlinePill(pill) {
        const group = pill.closest('[data-inline]');
        const kind = group.dataset.inline; // status | priority
        const id = group.dataset.id;
        const val = pill.dataset.value;
        const card = pill.closest('.td-task');
        updatingStart(card);
        post(`/api/tasks/${id}/${kind}`, { [kind]: val })
            .then(() => {
                // update UI
                group.querySelectorAll('.td-pill').forEach(p => p.classList.toggle('td-pill-active', p === pill));
                toast(`✓ ${kind === 'status' ? 'Trạng thái' : 'Ưu tiên'} cập nhật`);
                updatingEnd(card);
                // If status → done, refresh day to reflect completed state
                if (kind === 'status' && val === 'done') open(currentState.date, { projectId: currentState.projectId });
            })
            .catch(err => {
                updatingEnd(card);
                if (err.message === 'needs_review') toastReviewRequired(id);
                else toast(err.message || 'Lỗi', 'error');
            });
    }

    function handleReassign(sel) {
        const id = sel.dataset.id;
        const aid = sel.value;
        const card = sel.closest('.td-task');
        updatingStart(card);
        post(`/api/tasks/${id}/reassign`, aid ? { assignee_id: aid } : {})
            .then(r => {
                const display = card.querySelector('[data-assignee-display]');
                if (display) {
                    display.innerHTML = r.assignee_name
                        ? '👤 ' + esc(r.assignee_name)
                        : '<span style="opacity:.6">👤 Chưa giao</span>';
                }
                card.dataset.assigneeId = aid || '';
                toast(r.assignee_name ? `👤 Giao cho ${r.assignee_name}` : '👤 Bỏ giao');
                updatingEnd(card);
            })
            .catch(err => { updatingEnd(card); toast(err.message || 'Lỗi', 'error'); });
    }

    // ── Native date prompt ---------------------------------------
    function showDatePrompt(initial) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;animation:td-fade-in .15s';
            overlay.innerHTML = `
                <div style="background:var(--bg-primary,#0b1220);color:var(--text,#f1f5f9);padding:18px;border-radius:12px;min-width:280px;border:1px solid var(--border,rgba(255,255,255,.1));box-shadow:0 16px 40px rgba(0,0,0,.5)">
                    <div style="font-weight:600;margin-bottom:10px">Chuyển ngày</div>
                    <input type="date" value="${initial}" style="width:100%;padding:8px;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:6px;background:var(--bg-secondary,rgba(255,255,255,.04));color:inherit;font-size:14px">
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
                        <button type="button" class="td-btn" data-td-cancel>Huỷ</button>
                        <button type="button" class="td-btn td-primary" data-td-ok>Chuyển</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            const input = overlay.querySelector('input');
            input.focus();
            const cleanup = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('[data-td-cancel]').onclick = () => cleanup(null);
            overlay.querySelector('[data-td-ok]').onclick = () => cleanup(input.value);
            overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(null); });
            overlay.addEventListener('keydown', e => {
                if (e.key === 'Escape') cleanup(null);
                if (e.key === 'Enter') cleanup(input.value);
            });
        });
    }

    // ── Auto-binding on click ------------------------------------
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-td-open]');
        if (!trigger) return;
        const date = trigger.dataset.tdDate;
        if (!date) return;
        if (e.target.closest('a:not([data-td-open]), button:not([data-td-open])') && e.target !== trigger) return;
        e.preventDefault();
        open(date, { projectId: trigger.dataset.tdProject || null });
    });

    // ── TKT-102 · Task-level focus ───────────────────────────────
    //  Opens the drawer on the task's due date, scrolls to the matching
    //  task card and highlights it. If the task has no due date, the
    //  drawer falls back to APP_TODAY and still scrolls/highlights.
    function focusTask(taskId, opts = {}) {
        ensureMounted();
        titleEl.textContent = 'Loading task…';
        subEl.innerHTML = '<span>Fetching…</span>';
        root.classList.add('td-open');
        root.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        bodyEl.innerHTML = '<div class="td-skeleton"></div><div class="td-skeleton"></div>';
        footEl.hidden = true;

        fetch(BASE + '/api/tasks/' + encodeURIComponent(taskId) + '/quick', { credentials: 'same-origin' })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
            .then(task => {
                const date = task.due_date || APP_TODAY();
                const projectId = opts.projectId || task.project_id || null;
                currentState.projectId = projectId;
                currentState.focusTaskId = +taskId;
                // Re-use open() for the heavy lifting, then scroll to the focused card
                open(date, { projectId });
            })
            .catch(err => {
                bodyEl.innerHTML = `<div class="td-empty"><div class="td-empty-icon">⚠️</div>Không tìm thấy task: ${esc(err.message || '')}</div>`;
            });
    }

    // Patch render() to honour pending focusTaskId after it paints
    const _origRender = render;
    render = function (data) {
        _origRender(data);
        if (currentState.focusTaskId) {
            const target = bodyEl.querySelector('[data-task-id="' + currentState.focusTaskId + '"]');
            if (target) {
                bodyEl.querySelectorAll('.td-task.td-focus').forEach(c => c.classList.remove('td-focus'));
                target.classList.add('td-focus');
                const idx = Array.from(bodyEl.querySelectorAll('.td-task')).indexOf(target);
                if (idx >= 0) currentState.activeTaskIdx = idx;
                requestAnimationFrame(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }));
            }
            currentState.focusTaskId = null;
        }
    };

    // Public API
    window.TaskDrawer = { open, close, focusTask };
})();
