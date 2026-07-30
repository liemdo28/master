<?php
$pageTitle    = 'Deadline Extensions -- Admin';
$activeNav    = 'admin';
ob_start();
$statusFilter = $_GET['status'] ?? '';
?>
<div class="container" style="max-width:1100px;margin:0 auto;padding:24px 16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
    <div>
      <h1 style="font-size:1.4rem;font-weight:700;color:#F0F6FC;margin:0;">Deadline Extensions</h1>
      <p style="color:#8B949E;font-size:.875rem;margin:4px 0 0;">Review and manage extension requests</p>
    </div>
    <?php if (count($pending) > 0): ?>
    <div style="background:#2D1F00;border:1px solid #D29922;border-radius:8px;padding:10px 16px;text-align:center;">
      <span style="font-size:1.25rem;font-weight:700;color:#D29922;"><?= count($pending) ?></span>
      <span style="font-size:.8rem;color:#D29922;margin-left:6px;">pending review</span>
    </div>
    <?php endif; ?>
  </div>

  <!-- Filter tabs -->
  <div style="display:flex;gap:8px;margin-bottom:20px;">
    <?php foreach (['' => 'All', 'pending' => 'Pending', 'approved' => 'Approved', 'auto_approved' => 'Auto-approved', 'rejected' => 'Rejected'] as $val => $label): ?>
    <a href="?status=<?= $val ?>" style="padding:6px 14px;border-radius:6px;font-size:.8rem;font-weight:500;text-decoration:none;
       background:<?= $statusFilter === $val ? '#21262D' : 'transparent' ?>;
       color:<?= $statusFilter === $val ? '#F0F6FC' : '#8B949E' ?>;
       border:1px solid <?= $statusFilter === $val ? '#30363D' : 'transparent' ?>;">
      <?= $label ?>
    </a>
    <?php endforeach; ?>
  </div>

  <!-- Pending (review cards) -->
  <?php if ($pending && (!$statusFilter || $statusFilter === 'pending')): ?>
  <div style="margin-bottom:28px;">
    <h2 style="font-size:.875rem;font-weight:600;color:#D29922;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">Awaiting Review</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <?php foreach ($pending as $ext): ?>
      <div style="background:#161B22;border:1px solid #30363D;border-left:3px solid #D29922;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:16px;" id="ext-card-<?= $ext['id'] ?>">
        <div style="flex:1;">
          <div style="font-size:.875rem;font-weight:500;color:#F0F6FC;">
            <a href="<?= APP_URL ?>/tasks/<?= (int)$ext['task_id'] ?>" style="color:#58A6FF;text-decoration:none;"><?= e($ext['task_title']) ?></a>
          </div>
          <div style="font-size:.75rem;color:#8B949E;margin-top:2px;">
            Requested by <strong style="color:#C9D1D9;"><?= e($ext['requester_name']) ?></strong>
            &middot; <?= e($ext['original_due_date']) ?> &rarr; <strong style="color:#E6EDF3;"><?= e($ext['requested_due_date']) ?></strong>
            (+<?= (int)$ext['extension_days'] ?>d)
          </div>
          <?php if (!empty($ext['reason'])): ?>
          <div style="font-size:.75rem;color:#484F58;margin-top:4px;font-style:italic;">"<?= e(mb_substr($ext['reason'], 0, 120)) ?><?= mb_strlen($ext['reason']) > 120 ? '...' : '' ?>"</div>
          <?php endif; ?>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button onclick="extReview(<?= $ext['id'] ?>, 'approve')"
                  style="padding:6px 14px;background:#238636;color:#fff;border:none;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer;">
            Approve
          </button>
          <button onclick="extReview(<?= $ext['id'] ?>, 'reject')"
                  style="padding:6px 14px;background:transparent;color:#F85149;border:1px solid #F85149;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer;">
            Reject
          </button>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
  <?php endif; ?>

  <!-- All extensions table -->
  <?php if ($extensions): ?>
  <div style="background:#0D1117;border:1px solid #21262D;border-radius:8px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#161B22;border-bottom:1px solid #21262D;">
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Task</th>
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Requester</th>
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Extension</th>
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Status</th>
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Date</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($extensions as $ext):
          $statusColors = [
            'auto_approved' => ['#3FB950', '#0D2D0D'],
            'approved'      => ['#3FB950', '#0D2D0D'],
            'pending'       => ['#D29922', '#2D1F00'],
            'rejected'      => ['#F85149', '#2D0D0D'],
            'expired'       => ['#8B949E', '#21262D'],
          ];
          [$sc, $sbg] = $statusColors[$ext['status']] ?? ['#8B949E', '#21262D'];
          $statusLabel = [
            'auto_approved' => 'Auto-approved',
            'approved'      => 'Approved',
            'pending'       => 'Pending',
            'rejected'      => 'Rejected',
            'expired'       => 'Expired',
          ][$ext['status']] ?? $ext['status'];
        ?>
        <tr style="border-bottom:1px solid #21262D;">
          <td style="padding:12px 16px;">
            <a href="<?= APP_URL ?>/tasks/<?= (int)$ext['task_id'] ?>" style="color:#58A6FF;text-decoration:none;font-size:.875rem;"><?= e($ext['task_title'] ?? '') ?></a>
            <?php if (!empty($ext['project_name'])): ?><div style="font-size:.7rem;color:#484F58;"><?= e($ext['project_name']) ?></div><?php endif; ?>
          </td>
          <td style="padding:12px 16px;font-size:.875rem;color:#C9D1D9;"><?= e($ext['requester_name'] ?? '') ?></td>
          <td style="padding:12px 16px;font-size:.875rem;color:#C9D1D9;">
            <?= e($ext['original_due_date']) ?> &rarr; <?= e($ext['requested_due_date']) ?>
            <div style="font-size:.7rem;color:#484F58;">+<?= (int)$ext['extension_days'] ?>d</div>
          </td>
          <td style="padding:12px 16px;">
            <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:.75rem;font-weight:600;background:<?= $sbg ?>;color:<?= $sc ?>;"><?= $statusLabel ?></span>
          </td>
          <td style="padding:12px 16px;font-size:.75rem;color:#484F58;"><?= e(substr($ext['created_at'], 0, 10)) ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php else: ?>
  <div style="text-align:center;padding:60px 24px;color:#484F58;"><p>No extension requests found.</p></div>
  <?php endif; ?>
</div>

<!-- Review modal -->
<div id="extReviewModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center;">
  <div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:28px;width:420px;max-width:95vw;">
    <h3 style="color:#F0F6FC;margin:0 0 16px;font-size:1rem;" id="extModalTitle">Review Extension</h3>
    <label style="display:block;font-size:.8rem;color:#8B949E;margin-bottom:6px;">Note (optional for approve, required for reject)</label>
    <textarea id="extReviewNote" rows="3" style="width:100%;background:#0D1117;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;padding:10px;font-size:.875rem;resize:vertical;box-sizing:border-box;" placeholder="Add a note..."></textarea>
    <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
      <button onclick="document.getElementById('extReviewModal').style.display='none'"
              style="padding:8px 16px;background:transparent;color:#8B949E;border:1px solid #30363D;border-radius:6px;cursor:pointer;">Cancel</button>
      <button id="extModalSubmit" style="padding:8px 16px;background:#238636;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Confirm</button>
    </div>
  </div>
</div>

<script>
let _extAction = '', _extId = 0;
function extReview(id, action) {
    _extId = id; _extAction = action;
    const modal = document.getElementById('extReviewModal');
    document.getElementById('extModalTitle').textContent = action === 'approve' ? 'Approve Extension' : 'Reject Extension';
    const btn = document.getElementById('extModalSubmit');
    btn.textContent = action === 'approve' ? 'Approve' : 'Reject';
    btn.style.background = action === 'approve' ? '#238636' : '#b91c1c';
    document.getElementById('extReviewNote').value = '';
    modal.style.display = 'flex';
}
document.getElementById('extModalSubmit').onclick = async function() {
    const note = document.getElementById('extReviewNote').value.trim();
    if (_extAction === 'reject' && note.length < 3) { alert('Please provide a rejection reason.'); return; }
    const fd = new FormData();
    fd.append('csrf_token', '<?= csrf_token() ?>');
    fd.append('note', note);
    const r = await fetch(`<?= APP_URL ?>/api/admin/deadline-extensions/${_extId}/${_extAction}`, {method:'POST',body:fd,credentials:'same-origin'});
    const d = await r.json();
    if (d.ok) {
        document.getElementById('extReviewModal').style.display = 'none';
        const card = document.getElementById('ext-card-' + _extId);
        if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; }
        setTimeout(() => location.reload(), 600);
    } else { alert(d.error || 'Error'); }
};
</script>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
