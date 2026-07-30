/**
 * Phase 1 — Workflow Command Center JS
 * Loads /api/workflow/command-center and dispatches per-bucket lists.
 */
(function () {
  const root = document.getElementById('command-center-root');
  if (!root) return;
  const ts = document.getElementById('cc-timestamp');
  const list = document.getElementById('cc-list');
  const title = document.getElementById('cc-detail-title');

  function setVal(sel, val) {
    const el = document.querySelector(`[data-cc="${sel}"]`);
    if (el) el.textContent = (val === 0 || val === '0') ? '0' : (val ?? '—');
  }

  function setList(tasks) {
    list.innerHTML = '';
    if (!tasks || !tasks.length) {
      list.innerHTML = '<li><span class="cc-empty">No tasks in this bucket.</span></li>';
      return;
    }
    for (const t of tasks) {
      const li = document.createElement('li');
      const prio = (t.priority || 'medium').toLowerCase();
      li.innerHTML = `
        <div>
          <strong>#${t.id}</strong> ${escapeHtml(t.title || '(untitled)')}
          <div style="color:var(--cc-muted);font-size:11px;margin-top:2px">
            ${t.due_date || '—'} · ${t.status || ''}
          </div>
        </div>
        <span class="cc-prio ${prio}">${prio}</span>`;
      list.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  async function load() {
    try {
      const res = await fetch('/api/workflow/command-center', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const d = json.data || {};
      setVal('my_work.assigned_to_me', d.my_work?.assigned_to_me);
      setVal('my_work.due_today',      d.my_work?.due_today);
      setVal('my_work.overdue_mine',   d.my_work?.overdue_mine);
      setVal('my_work.mentioned_me',   d.my_work?.mentioned_me);
      setVal('my_work.waiting_on_me',  d.my_work?.waiting_on_me);
      setVal('review.needs_review',    d.review?.needs_review);
      setVal('approve.needs_approval', d.approve?.needs_approval);
      setVal('critical_today',         d.critical_today);
      setVal('blocked',                d.blocked);
      if (ts && d.generated_at) ts.textContent = new Date(d.generated_at).toLocaleString();
    } catch (e) {
      console.error('command-center load failed', e);
    }
  }

  // Bucket click handlers
  document.querySelectorAll('.cc-card').forEach(card => {
    card.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const bucket = card.dataset.ccBucket;
      const map = {
        my_work: { title: 'My Work',          endpoint: '/api/workflow/my-work/list?bucket=assigned_to_me' },
        review:  { title: 'Needs My Review',  endpoint: '/api/workflow/reviewer-queue/list?bucket=needs_review' },
        approve: { title: 'Needs My Approval', endpoint: '/api/workflow/approver-queue/list?bucket=needs_approval' },
        critical:{ title: 'Critical Today',   endpoint: '/api/workflow/my-work/list?bucket=due_today' },
      };
      const cfg = map[bucket];
      title.textContent = cfg.title;
      list.innerHTML = '<li><span class="cc-empty">Loading…</span></li>';
      try {
        const res = await fetch(cfg.endpoint, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        setList(json.data?.tasks || []);
      } catch (e) {
        list.innerHTML = '<li><span class="cc-empty">Failed to load: ' + escapeHtml(String(e)) + '</span></li>';
      }
    });
  });

  load();
  setInterval(load, 30_000);
})();
