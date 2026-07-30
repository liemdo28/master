/* =========================================================
   TKT-204 · Bulk actions on list-view task rows
   Click task-check to select. Shift-click extends range.
   Floating action bar appears when ≥ 1 selected.
   Ctrl/⌘+A = select all visible.
   ========================================================= */
(function () {
    'use strict';
    const rows = () => Array.from(document.querySelectorAll('[data-task-row-id]'));
    if (!rows().length) return;

    const BASE = (window.APP_URL || '').replace(/\/$/, '');
    const CSRF = () => (window.CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || '');

    const selected = new Set();
    let lastClickedIdx = -1;

    const bar = document.createElement('div');
    bar.className = 'ba-bar';
    bar.hidden = true;
    bar.innerHTML = `
        <div class="ba-count"><span class="ba-count-num">0</span> task đã chọn</div>
        <div class="ba-actions">
            <button type="button" class="ba-btn ba-primary" data-ba="complete">✓ Complete</button>
            <button type="button" class="ba-btn" data-ba="snooze">+7d</button>
            <button type="button" class="ba-btn" data-ba="move">📅 Move</button>
            <button type="button" class="ba-btn" data-ba="reassign">👤 Reassign</button>
            <button type="button" class="ba-btn ba-danger" data-ba="clear">Bỏ chọn</button>
        </div>`;
    document.body.appendChild(bar);

    function refresh() {
        bar.hidden = selected.size === 0;
        bar.querySelector('.ba-count-num').textContent = selected.size;
        rows().forEach(r => {
            const id = +r.dataset.taskRowId;
            r.classList.toggle('ba-selected', selected.has(id));
        });
    }

    function select(id, idx, shift) {
        if (shift && lastClickedIdx >= 0) {
            const lo = Math.min(idx, lastClickedIdx), hi = Math.max(idx, lastClickedIdx);
            for (let i = lo; i <= hi; i++) {
                const rowId = +rows()[i].dataset.taskRowId;
                selected.add(rowId);
            }
        } else {
            if (selected.has(id)) selected.delete(id); else selected.add(id);
        }
        lastClickedIdx = idx;
        refresh();
    }

    // Hook task-check clicks for selection (shift-click for range)
    document.addEventListener('click', (e) => {
        const check = e.target.closest('.task-check');
        if (!check) return;
        const row = check.closest('[data-task-row-id]');
        if (!row) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault(); e.stopPropagation();
            const id = +row.dataset.taskRowId;
            const idx = rows().indexOf(row);
            select(id, idx, e.shiftKey);
        }
    }, true); // capture phase so it runs before toggleTask

    // Ctrl/⌘+A = select all visible
    document.addEventListener('keydown', (e) => {
        const isA = (e.key || '').toLowerCase() === 'a';
        if (isA && (e.metaKey || e.ctrlKey) && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
            e.preventDefault();
            rows().forEach(r => selected.add(+r.dataset.taskRowId));
            refresh();
        } else if (e.key === 'Escape' && selected.size) {
            selected.clear(); refresh();
        }
    });

    // Action bar
    bar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ba]');
        if (!btn) return;
        const act = btn.dataset.ba;
        if (act === 'clear') { selected.clear(); refresh(); return; }
        if (!selected.size) return;
        bulk(act);
    });

    function bulk(action) {
        const ids = Array.from(selected);
        const body = { ids: ids.join(','), action };
        if (action === 'snooze') { body.days = '7'; }
        if (action === 'move') {
            const d = prompt('Chuyển ' + ids.length + ' task sang ngày (YYYY-MM-DD):', (window.APP_TODAY || ''));
            if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
            body.due_date = d;
        }
        if (action === 'reassign') {
            const aid = prompt('ID người được giao (để trống = bỏ giao):', '');
            if (aid === null) return;
            body.assignee_id = aid.trim();
        }
        const form = new URLSearchParams(body);
        form.append('csrf_token', CSRF());
        fetch(BASE + '/api/tasks/bulk', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': CSRF() },
            body: form.toString()
        })
        .then(r => r.json())
        .then(j => {
            if (j.error) throw new Error(j.error);
            toast(`✓ ${j.touched}/${ids.length} task đã cập nhật` + (j.next_occurrences?.length ? ` · +${j.next_occurrences.length} occurrence` : ''));
            selected.clear(); refresh();
            setTimeout(() => location.reload(), 400);
        })
        .catch(err => toast(err.message || 'Lỗi', 'error'));
    }

    function toast(msg, type) {
        let wrap = document.getElementById('ba-toast');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'ba-toast'; wrap.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1200;display:flex;flex-direction:column;gap:8px'; document.body.appendChild(wrap); }
        const el = document.createElement('div');
        el.style.cssText = 'background:rgba(15,23,42,.96);color:#f1f5f9;border:1px solid rgba(255,255,255,.1);border-left:3px solid ' + (type === 'error' ? '#ef4444' : '#22c55e') + ';padding:10px 14px;border-radius:8px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:320px';
        el.textContent = msg;
        wrap.appendChild(el);
        setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, 2400);
        setTimeout(() => el.remove(), 2800);
    }
})();
