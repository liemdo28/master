<?php
/**
 * Phase 1 — Workflow Command Center
 * Full-page action-first dashboard for CEO / Manager.
 * GET /command-center
 */
$extraCss[] = 'workflow-command-center.css';
$extraJs[]  = 'workflow-command-center.js';

// ── Default bucket to show on first load ─────────────────────────────────────
$defaultBucket = $_GET['bucket'] ?? 'my_work';
$userRole = currentUser()['role'] ?? 'member';
?>
<div class="cc-root" id="cc-root" data-csrf="<?= e(csrf_token()) ?>"
     data-user-role="<?= e($userRole) ?>" data-user-id="<?= (int)$_SESSION['user_id'] ?>">

  <!-- ── Top Navigation Tabs ────────────────────────────────────────────── -->
  <nav class="cc-tabs">
    <button class="cc-tab active" data-bucket="my_work">My Work</button>
    <button class="cc-tab" data-bucket="review">Reviewer Queue</button>
    <button class="cc-tab" data-bucket="approve">Approver Queue</button>
    <button class="cc-tab" data-bucket="critical">CEO View</button>
  </nav>

  <!-- ── Summary Cards ─────────────────────────────────────────────────── -->
  <section class="cc-summary-grid" id="cc-summary-grid">
    <!-- Filled by JS from /api/workflow/command-center -->
  </section>

  <!-- ── Active Queue Panel ────────────────────────────────────────────── -->
  <section class="cc-queue" id="cc-queue">

    <!-- Queue header + filters -->
    <div class="cc-queue-header">
      <h2 class="cc-queue-title" id="cc-queue-title">Loading…</h2>
      <div class="cc-queue-filters" id="cc-queue-filters">
        <select id="cc-filter-priority" class="cc-select">
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select id="cc-filter-status" class="cc-select">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="review">In Review</option>
          <option value="approved">Approved</option>
        </select>
        <input type="text" id="cc-search" class="cc-search" placeholder="Search tasks…">
      </div>
    </div>

    <!-- Task list -->
    <ul class="cc-task-list" id="cc-task-list">
      <li class="cc-empty-row">
        <span class="cc-empty">Select a queue above to load tasks.</span>
      </li>
    </ul>

    <!-- Pagination -->
    <div class="cc-pagination" id="cc-pagination"></div>
  </section>

</div>

<script>
// ── Phase 1: Command Center — inline init ─────────────────────────────────────
// Reads bucket from URL param or tab selection and loads the queue.
(function () {
  var root     = document.getElementById('cc-root');
  var summaryGrid = document.getElementById('cc-summary-grid');
  var list     = document.getElementById('cc-task-list');
  var title    = document.getElementById('cc-queue-title');
  var tabs     = document.querySelectorAll('.cc-tab');
  var filterPrio = document.getElementById('cc-filter-priority');
  var filterStatus = document.getElementById('cc-filter-status');
  var searchBox = document.getElementById('cc-search');
  var activeBucket = new URLSearchParams(location.search).get('bucket') || 'my_work';
  var currentPage = 1;
  var perPage = 20;
  var rawTasks = [];

  function esc(s) {
    return String(s||'').replace(/[&<>"']/g,
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||'');
  }

  function badge(p) {
    var m={'urgent':'🔴 Urgent','high':'🟠 High','medium':'🔵 Medium','low':'⚪ Low'};
    return '<span class="cc-badge '+p+'">'+esc(m[p]||p)+'</span>';
  }

  function statusLabel(s) {
    var m={'pending':'⏳ Pending','in_progress':'🔄 In Progress','review':'👀 In Review',
           'approved':'✅ Approved','rejected':'❌ Rejected','done':'🏁 Done'};
    return '<span class="cc-status '+s+'">'+esc(m[s]||s)+'</span>';
  }

  function renderTasks(tasks) {
    list.innerHTML = '';
    if (!tasks.length) {
      list.innerHTML = '<li class="cc-empty-row"><span class="cc-empty">No tasks in this queue.</span></li>';
      return;
    }
    tasks.forEach(function (t) {
      var prio = esc(t.priority||'medium').toLowerCase();
      var due  = t.due_date ? esc(t.due_date) : '—';
      var isOverdue = t.due_date && t.due_date < '<?= app_today() ?>' && t.is_completed != '1' && t.is_completed != 1;
      var row = document.createElement('li');
      row.className = 'cc-task-row' + (isOverdue ? ' overdue' : '');
      row.dataset.id = t.id;
      row.innerHTML =
        '<div class="cc-task-main">'+
          badge(prio)+
          '<a class="cc-task-title" href="/tasks/'+t.id+'" target="_self">#'+t.id+' '+esc(t.title||'(untitled)')+'</a>'+
        '</div>'+
        '<div class="cc-task-meta">'+
          statusLabel(t.status)+
          '<span class="cc-due">Due: '+due+'</span>'+
          (t.assignee_name?'<span class="cc-assignee">👤 '+esc(t.assignee_name)+'</span>':'')+
          (t.project_name?'<span class="cc-project">📁 '+esc(t.project_name)+'</span>':'')+
        '</div>';
      list.appendChild(row);
    });
  }

  function applyFilters() {
    var prio   = filterPrio.value;
    var status = filterStatus.value;
    var q      = (searchBox.value||'').toLowerCase();
    var filtered = rawTasks.filter(function (t) {
      if (prio   && (t.priority||'').toLowerCase() !== prio)   return false;
      if (status && (t.status||'')    !== status)                return false;
      if (q) {
        return ((t.title||'')+' '+(t.project_name||'')).toLowerCase().indexOf(q)!==-1;
      }
      return true;
    });
    renderTasks(filtered);
  }

  filterPrio.addEventListener('change', applyFilters);
  filterStatus.addEventListener('change', applyFilters);
  searchBox.addEventListener('input', applyFilters);

  // ── Load summary + queue ───────────────────────────────────────────────────
  function loadBucket(bucket) {
    activeBucket = bucket;
    currentPage = 1;
    list.innerHTML = '<li class="cc-empty-row"><span class="cc-empty">Loading…</span></li>';

    var endpoint;
    switch (bucket) {
      case 'review':  endpoint = '/api/workflow/reviewer-queue/list?bucket=needs_review'; break;
      case 'approve': endpoint = '/api/workflow/approver-queue/list?bucket=needs_approval'; break;
      case 'critical':endpoint = '/api/workflow/my-work/list?bucket=overdue_mine'; break;
      default:        endpoint = '/api/workflow/my-work/list?bucket=assigned_to_me';
    }

    var titles = {
      my_work:'My Work — Assigned To Me',
      review:'Reviewer Queue — Needs My Review',
      approve:'Approver Queue — Needs My Approval',
      critical:'CEO View — Overdue & Critical'
    };
    title.textContent = titles[bucket] || 'Queue';

    fetch(endpoint, { credentials: 'same-origin' })
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(json) {
        rawTasks = json.data && json.data.tasks ? json.data.tasks : [];
        applyFilters();
      })
      .catch(function(e) {
        list.innerHTML = '<li class="cc-empty-row"><span class="cc-empty">Failed to load: '+esc(String(e))+'</span></li>';
      });
  }

  // ── Load summary grid ───────────────────────────────────────────────────────
  function loadSummary() {
    fetch('/api/workflow/command-center', { credentials: 'same-origin' })
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(json) {
        var d = json.data || {};
        var mw = d.my_work || {};
        summaryGrid.innerHTML =
          '<a class="cc-card cc-card-mywork '+ (mw.assigned_to_me>0?'has-items':'') +'" data-bucket="my_work" href="/command-center?bucket=my_work">'+
            '<div class="cc-card-icon">📋</div><div class="cc-card-label">My Work</div>'+
            '<div class="cc-card-num">'+mw.assigned_to_me+'</div>'+
            '<div class="cc-card-sub">Today: '+mw.due_today+' · Overdue: '+mw.overdue_mine+'</div>'+
          '</a>'+
          '<a class="cc-card cc-card-review '+ (d.review&&d.review.needs_review>0?'has-items':'') +'" data-bucket="review" href="/command-center?bucket=review">'+
            '<div class="cc-card-icon">👀</div><div class="cc-card-label">Needs Review</div>'+
            '<div class="cc-card-num">'+(d.review?d.review.needs_review:'—')+'</div>'+
            '<div class="cc-card-sub">Evidence: '+(d.review?d.review.waiting_evidence:'—')+'</div>'+
          '</a>'+
          '<a class="cc-card cc-card-approve '+ (d.approve&&d.approve.needs_approval>0?'has-items':'') +'" data-bucket="approve" href="/command-center?bucket=approve">'+
            '<div class="cc-card-icon">✅</div><div class="cc-card-label">Needs Approval</div>'+
            '<div class="cc-card-num">'+(d.approve?d.approve.needs_approval:'—')+'</div>'+
            '<div class="cc-card-sub">Accepted: '+(d.approve?d.approve.accepted:'—')+'</div>'+
          '</a>'+
          '<a class="cc-card cc-card-critical '+ (d.critical_today>0?'has-items':'') +'" data-bucket="critical" href="/command-center?bucket=critical">'+
            '<div class="cc-card-icon">🚨</div><div class="cc-card-label">Critical / Overdue</div>'+
            '<div class="cc-card-num">'+(d.critical_today||'0')+'</div>'+
            '<div class="cc-card-sub">Blocked: '+(d.blocked||'—')+'</div>'+
          '</a>';

        // Wire card clicks
        summaryGrid.querySelectorAll('.cc-card').forEach(function(card){
          card.addEventListener('click', function(e){
            e.preventDefault();
            var b = card.dataset.bucket;
            tabs.forEach(function(t){ t.classList.toggle('active', t.dataset.bucket===b); });
            loadBucket(b);
          });
        });
      })
      .catch(function(e){ console.error('summary load failed', e); });
  }

  // Tab clicks
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      tabs.forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      loadBucket(tab.dataset.bucket);
    });
  });

  // Highlight active tab from URL
  tabs.forEach(function(t){
    if (t.dataset.bucket === activeBucket) {
      t.classList.add('active');
      loadBucket(activeBucket);
    }
  });

  loadSummary();
  if (!new URLSearchParams(location.search).get('bucket')) loadBucket('my_work');
})();
</script>
