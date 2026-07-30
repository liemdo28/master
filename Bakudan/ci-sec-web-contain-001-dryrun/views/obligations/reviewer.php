<?php
$pageTitle = 'Reviewer Queue — Obligations';
$currentPage = 'obligations-reviewer';
ob_start();
$queue = $pending ?? $queue ?? [];
?>
<style>
.ob-wrap{max-width:1440px;margin:0 auto;padding:24px;color:#F1F5F9}.ob-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}.ob-card{background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:16px}.ob-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;border:none;cursor:pointer}.ob-btn-ghost{background:rgba(255,255,255,.06);color:#F1F5F9;border:1px solid rgba(255,255,255,.08)}.ob-btn-primary{background:#2563EB;color:#fff}.ob-btn-warn{background:#D97706;color:#fff}.ob-table{width:100%;border-collapse:collapse;font-size:13px}.ob-table th{font-size:10px;color:#94A3B8;text-transform:uppercase;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}.ob-table td{padding:12px 8px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}.flash{padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:13px}.flash-success{background:rgba(34,197,94,.15);color:#86EFAC}.flash-error{background:rgba(239,68,68,.15);color:#FCA5A5}textarea{width:100%;min-height:70px;background:#0F172A;color:#F1F5F9;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px}label{display:block;font-size:12px;color:#CBD5E1;margin:4px 0}.ob-empty{text-align:center;color:#94A3B8;padding:32px}
</style>
<div class="ob-wrap">
<?php if($s=flash('success')):?><div class="flash flash-success"><?= e($s) ?></div><?php endif; ?>
<?php if($e=flash('error')):?><div class="flash flash-error"><?= e($e) ?></div><?php endif; ?>
<div class="ob-header"><div><h1>Reviewer Queue</h1><p><?= count($queue) ?> item(s) pending review</p></div><div><a class="ob-btn ob-btn-ghost" href="<?= APP_URL ?>/obligations">← Obligations</a> <a class="ob-btn ob-btn-ghost" href="<?= APP_URL ?>/obligations/approver">Approver Queue →</a></div></div>
<div class="ob-card">
<?php if(empty($queue)): ?><div class="ob-empty"><h2>All caught up!</h2><p>No obligation payments are waiting for review.</p></div><?php else: ?>
<table class="ob-table"><thead><tr><th>Obligation</th><th>Store</th><th>Due</th><th>Status</th><th>Evidence</th><th>Review</th></tr></thead><tbody>
<?php foreach($queue as $item): ?>
<tr>
<td><strong><?= e($item['obligation_name'] ?? '—') ?></strong><br><span style="color:#94A3B8"><?= e($item['vendor'] ?? '') ?></span></td>
<td><?= e($item['store_name'] ?? $item['store_db_name'] ?? '—') ?></td>
<td><?= !empty($item['due_date']) ? e(date('M j, Y', strtotime($item['due_date']))) : '—' ?></td>
<td><?= e($item['status'] ?? 'pending') ?></td>
<td>
<label><input type="checkbox" disabled <?= !empty($item['evidence_invoice'])?'checked':'' ?>> Invoice uploaded</label>
<label><input type="checkbox" disabled <?= !empty($item['evidence_receipt'])?'checked':'' ?>> Receipt uploaded</label>
<label><input type="checkbox" disabled <?= !empty($item['amount'])?'checked':'' ?>> Amount captured</label>
<label><input type="checkbox" disabled <?= !empty($item['due_date'])?'checked':'' ?>> Due date matches</label>
</td>
<td>
<form method="POST" action="<?= APP_URL ?>/api/obligations/review/<?= (int)$item['id'] ?>">
<input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
<textarea name="notes" placeholder="Reviewer notes..."><?= e($item['reviewer_notes'] ?? '') ?></textarea>
<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
<button class="ob-btn ob-btn-primary" type="submit" name="result" value="approved">Approve Review</button>
<button class="ob-btn ob-btn-warn" type="submit" name="result" value="changes_requested">Request Changes</button>
</div>
</form>
</td>
</tr>
<?php endforeach; ?></tbody></table><?php endif; ?>
</div></div>
<?php $content=ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>