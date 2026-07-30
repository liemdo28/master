/* =========================================================
   TKT-203 · Saved Views — localStorage-backed filter shortcuts
   Pushes a chip row onto the preset-row with saved query strings.
   ========================================================= */
(function () {
    'use strict';
    const KEY = 'tf-saved-views-v1';
    const presetRow = document.querySelector('.tf-preset-row');
    if (!presetRow) return;

    function read()  { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
    function write(v){ localStorage.setItem(KEY, JSON.stringify(v)); }

    function esc(s){ const e = document.createElement('div'); e.textContent = s == null ? '' : s; return e.innerHTML; }

    function render() {
        // remove existing rendered saved chips
        presetRow.querySelectorAll('[data-sv-chip]').forEach(n => n.remove());
        const saveBtn = presetRow.querySelector('[data-sv-save]');
        if (saveBtn) saveBtn.remove();

        const views = read();
        const currentPath = location.pathname;
        const anchor = presetRow.querySelector('.tf-preset-sep') || presetRow.lastElementChild;
        views.filter(v => v.path === currentPath).forEach(v => {
            const chip = document.createElement('a');
            chip.className = 'tf-preset tf-preset-saved';
            chip.dataset.svChip = v.id;
            chip.href = v.path + '?' + v.query;
            chip.innerHTML = `<span class="tf-preset-icon">⭐</span> ${esc(v.name)}<button type="button" class="tf-sv-del" title="Xoá view" data-sv-del="${v.id}">×</button>`;
            presetRow.insertBefore(chip, anchor);
        });

        // Save current view button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tf-preset tf-preset-save';
        btn.dataset.svSave = '1';
        btn.innerHTML = '<span class="tf-preset-icon">＋</span> Lưu view';
        presetRow.insertBefore(btn, anchor);
        btn.addEventListener('click', saveCurrent);

        presetRow.querySelectorAll('[data-sv-del]').forEach(x => {
            x.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const id = x.dataset.svDel;
                write(read().filter(v => v.id !== id));
                render();
            });
        });
    }

    function saveCurrent() {
        const name = (prompt('Tên view (vd. "Raw - urgent today"):') || '').trim();
        if (!name) return;
        const view = {
            id: 'sv-' + Date.now().toString(36),
            name,
            path: location.pathname,
            query: location.search.replace(/^\?/, ''),
        };
        const all = read();
        // dedupe by name+path
        const existing = all.findIndex(v => v.path === view.path && v.name === name);
        if (existing >= 0) all[existing] = view;
        else all.push(view);
        write(all);
        render();
    }

    render();
})();
