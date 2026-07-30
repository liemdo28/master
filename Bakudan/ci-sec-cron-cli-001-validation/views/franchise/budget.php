<?php
$pageTitle = 'Budget & Approvals';
$currentPage = 'admin-budget';
ob_start();
?>
<style>
.bg-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.bg-stat{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;text-align:center}
.bg-stat__val{font-size:24px;font-weight:700;color:#f4f4f5}
.bg-stat__label{font-size:12px;color:#71717a;margin-top:4px}
.bg-table{width:100%;border-collapse:collapse}
.bg-table th{text-align:left;padding:10px 12px;font-size:12px;color:#71717a;border-bottom:1px solid #27272a}
.bg-table td{padding:10px 12px;border-bottom:1px solid #1f1f23;font-size:14px;color:#d4d4d8}
.bg-table tr:hover td{background:#1c1c20}
.bg-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase}
.bg-badge--submitted{background:#1e3a5f;color:#60a5fa}
.bg-badge--approved{background:#052e16;color:#4ade80}
.bg-badge--rejected{background:#450a0a;color:#fca5a5}
.bg-badge--purchased{background:#422006;color:#fbbf24}
.bg-badge--completed{background:#064e3b;color:#34d399}
.bg-badge--draft{background:#27272a;color:#71717a}
.bg-badge--under_review{background:#2d2250;color:#a78bfa}
.bg-btn{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;border:none;cursor:pointer;color:#fff}
.bg-btn--approve{background:#059669}.bg-btn--approve:hover{background:#047857}
.bg-btn--reject{background:#dc2626}.bg-btn--reject:hover{background:#b91c1c}
.bg-btn--new{background:#3b82f6;padding:8px 16px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.bg-amount{font-family:monospace;font-weight:600;color:#f4f4f5}
</style>

<div class="bg-stats">
    <div class="bg-stat"><div class="bg-stat__val" style="color:#60a5fa"><?= (int)($stats['pending'] ?? 0) ?></div><div class="bg-stat__label">Pending</div></div>
    <div class="bg-stat"><div class="bg-stat__val" style="color:#4ade80"><?= (int)($stats['approved'] ?? 0) ?></div><div class="bg-stat__label">Approved</div></div>
    <div class="bg-stat"><div class="bg-stat__val" style="color:#fca5a5"><?= (int)($stats['rejected'] ?? 0) ?></div><div class="bg-stat__label">Rejected</div></div>
    <div class="bg-stat"><div class="bg-stat__val" style="color:#4ade80">$<?= number_format((float)($stats['approved_total'] ?? 0), 0) ?></div><div class="bg-stat__label">Approved Total</div></div>
    <div class="bg-stat"><div class="bg-stat__val" style="color:#fbbf24">$<?= number_format((float)($stats['pending_total'] ?? 0), 0) ?></div><div class="bg-stat__label">Pending Total</div></div>
</div>

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div style="display:flex;gap:8px">
        <a href="<?= APP_URL ?>/admin/budget" class="bg-btn" style="background:<?= empty($_GET['status'])?'#3b82f6':'#27272a' ?>">All</a>
        <a href="<?= APP_URL ?>/admin/budget?status=submitted" class="bg-btn" style="background:<?= ($_GET['status']??'')==='submitted'?'#3b82f6':'#27272a' ?>">Pending</a>
        <a href="<?= APP_URL ?>/admin/budget?status=approved" class="bg-btn" style="background:<?= ($_GET['status']??'')==='approved'?'#3b82f6':'#27272a' ?>">Approved</a>
    </div>
    <button class="bg-btn bg-btn--new" onclick="document.getElementById('budgetModal').classList.add('open')">+ New Request</button>
</div>

<?php if (empty($requests)): ?>
<div style="text-align:center;padding:40px;color:#71717a"><p>No budget requests found.</p></div>
<?php else: ?>
<table class="bg-table">
    <thead><tr><th>Request</th><th>Store</th><th>Category</th><th>Amount</th><th>Status</th><th>Requester</th><th>Date</th><?php if(canAdmin()):?><th>Action</th><?php endif;?></tr></thead>
    <tbody>
    <?php foreach ($requests as $r): ?>
    <tr>
        <td style="color:#f4f4f5;font-weight:500"><?= e($r['title']) ?></td>
        <td><?= e($r['store_name'] ?? '—') ?></td>
        <td style="text-transform:capitalize"><?= e($r['category']) ?></td>
        <td><span class="bg-amount">$<?= number_format((float)$r['amount'], 2) ?></span></td>
        <td><span class="bg-badge bg-badge--<?= $r['status'] ?>"><?= ucwords(str_replace('_',' ',$r['status'])) ?></span></td>
        <td style="font-size:13px;color:#a1a1aa"><?= e($r['requester_name'] ?? '') ?></td>
        <td style="font-size:12px;color:#71717a"><?= date('M j', strtotime($r['created_at'])) ?></td>
        <?php if(canAdmin()):?>
        <td>
            <?php if ($r['status'] === 'submitted'): ?>
            <button class="bg-btn bg-btn--approve" onclick="budgetAction(<?= $r['id'] ?>,'approve')">✓</button>
            <button class="bg-btn bg-btn--reject" onclick="budgetAction(<?= $r['id'] ?>,'reject')">✗</button>
            <?php endif; ?>
        </td>
        <?php endif;?>
    </tr>
    <?php endforeach; ?>
    </tbody>
</table>
<?php endif; ?>

<!-- Create Budget Request Modal -->
<div class="gl-modal" id="budgetModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;align-items:center;justify-content:center">
<div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;width:100%;max-width:500px">
    <h3 style="color:#f4f4f5;margin:0 0 16px">New Budget Request</h3>
    <form method="POST" action="<?= APP_URL ?>/admin/budget/create">
        <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
        <div class="gl-form-row"><label style="display:block;font-size:12px;color:#71717a;margin-bottom:4px">Title</label><input type="text" name="title" required style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="gl-form-row"><label style="display:block;font-size:12px;color:#71717a;margin-bottom:4px">Category</label><select name="category" style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px"><option value="equipment">Equipment</option><option value="repairs">Repairs</option><option value="supplies">Supplies</option><option value="training">Training</option><option value="marketing">Marketing</option><option value="other">Other</option></select></div>
            <div class="gl-form-row"><label style="display:block;font-size:12px;color:#71717a;margin-bottom:4px">Amount ($)</label><input type="number" name="amount" step="0.01" required style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="gl-form-row"><label style="display:block;font-size:12px;color:#71717a;margin-bottom:4px">Priority</label><select name="priority" style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div class="gl-form-row"><label style="display:block;font-size:12px;color:#71717a;margin-bottom:4px">Vendor</label><input type="text" name="vendor_name" style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button type="submit" class="bg-btn bg-btn--new">Submit Request</button>
            <button type="button" class="bg-btn" style="background:#27272a" onclick="document.getElementById('budgetModal').style.display='none'">Cancel</button>
        </div>
    </form>
</div>
</div>

<script>
function budgetAction(id, action) {
    const reason = action === 'reject' ? (prompt('Rejection reason:') || '') : '';
    fetch(`<?= APP_URL ?>/api/admin/budget/${id}/action`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:`csrf_token=<?= csrf_token() ?>&action=${action}&reason=${encodeURIComponent(reason)}`
    }).then(r=>r.json()).then(d=>{ if(d.success) location.reload(); });
}
document.getElementById('budgetModal').addEventListener('click',function(e){if(e.target===this)this.style.display='none'});
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
