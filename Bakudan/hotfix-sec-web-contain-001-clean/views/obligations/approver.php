<?php
$pageTitle = 'Approver Queue — Obligations';
$currentPage = 'obligations-approver';
ob_start();
?>
<style>
.ob-wrap{max-width:1440px;margin:0 auto;padding:24px;color:#F1F5F9}
.ob-card{background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:16px}
.ob-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;border:none;cursor:pointer}
.ob-btn-ghost{background:rgba(255,255,255,.06);color:#F1F5F9;border:1px solid rgba(255,255,255,.08)}
.ob-btn-success{background:#16A34A;color:#fff}
.ob-btn-danger{background:#DC2626;color:#fff}
.ob-btn-warn{background:#D97706;color:#fff}
.ob-table{width:100%;border-collapse:collapse;font-size:13px}
.ob-table th{font-size:10px;color:#94A3B8;text-transform:uppercase;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
.ob-table td{padding:14px 8px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
textarea,select{width:100%;background:#0F172A;color:#F1F5F9;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px;font-size:13px;box-sizing:border-box}
.flash{padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:13px}
.flash-success{background:rgba(34,197,94,.15);color:#86EFAC}
.flash-error{background:rgba(239,68,68,.15);color:#FCA5A5}
.ob-empty{text-align:center;color:#94A3B8;padding:48px}
.ob-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(59,130,246,.2);color:#93C5FD}
</style>
<div class="ob-wrap">
<?php if($s=flash('success')):?><div class="flash flash-success"><?=e($s)?></div><?php endif;?>
<?php if($e=flash('error')):?><div class="flash flash-error"><?=e($e)?></div><?php endif;?>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px">
<div><h1 style="font-size:22px;margin:0">Approver Queue</h1>
<p style="color:#94A3B8;font-size:13px;margin:4px 0 0"><?=count($pending??[])?> item(s) awaiting final approval</p></div>
<div style="display:flex;gap:8px">
<a class="ob-btn ob-btn-ghost" href="<?=APP_URL?>/obligations">← Obligations</a>
<a class="ob-btn ob-btn-ghost" href="<?=APP_URL?>/obligations/reviewer">Reviewer Queue →</a>
</div>
</div>

<?php if(empty($pending)):?>
<div class="ob-card ob-empty">
<h2 style="color:#F1F5F9;margin:0 0 8px">No items awaiting approval</h2>
<p>All reviewed payments have been finalised. Great work!</p>
</div>
<?php else:?>
<div class="ob-card">
<table class="ob-table">
<thead><tr>
<th>Obligation</th><th>Store</th><th>Due</th><th>Status</th>
<th>Reviewer Notes</th><th>Approval History</th><th>Decision</th>
</tr></thead>
<tbody>
<?php foreach($pending as $item):?>
<tr>
<td>
<strong><?=e($item['obligation_name']??$item['name']??'—')?></strong>
<br><span style="color:#94A3B8"><?=e($item['vendor']??'')?></span>
<br><span style="color:#64748B;font-size:11px">Payment #<?=(int)$item['id']?></span>
</td>
<td><?=e($item['store_name']??$item['store_db_name']??'—')?></td>
<td><?=!empty($item['due_date'])?e(date('M j, Y',strtotime($item['due_date']))):'—'?></td>
<td><span class="ob-pill"><?=e(ucfirst($item['status']??'review'))?></span></td>
<td>
<?php if(!empty($item['reviewer_notes'])):?>
<div style="color:#CBD5E1;font-size:12px;line-height:1.4;max-width:240px"><?=e(mb_strimwidth($item['reviewer_notes'],0,200,'…'))?></div>
<?php else:?><span style="color:#64748B">—</span><?php endif;?>
<?php if(!empty($item['reviewer_result_at'])):?>
<br><span style="color:#94A3B8;font-size:11px"><?=e(date('M j, g:i A',strtotime($item['reviewer_result_at'])))?></span>
<?php endif;?>
</td>
<td>
<?php
$hist = [];
if (!empty($item['reviewer_result'])) $hist[] = 'Reviewer: '.ucfirst(str_replace('_',' ',$item['reviewer_result']));
if (!empty($item['approver_result'])) $hist[] = 'Approver: '.ucfirst(str_replace('_',' ',$item['approver_result']));
echo empty($hist) ? '<span style="color:#64748B">—</span>' : e(implode(' → ', $hist));
?>
</td>
<td>
<form method="POST" action="<?=APP_URL?>/api/obligations/approve/<?=(int)$item['id']?>">
<input type="hidden" name="csrf" value="<?=e(csrf_token())?>">
<textarea name="notes" rows="2" placeholder="Approver notes..." style="margin-bottom:6px"><?=e($item['approver_notes']??'')?></textarea>
<select name="result" style="margin-bottom:6px">
<option value="approved" selected>✅ Approve</option>
<option value="rejected">❌ Reject</option>
<option value="changes_requested">🔄 Request Changes</option>
</select>
<div style="display:flex;gap:6px;flex-wrap:wrap">
<button type="submit" class="ob-btn ob-btn-success">Submit</button>
<a href="<?=APP_URL?>/obligations/payment/<?=(int)$item['id']?>" class="ob-btn ob-btn-ghost">Detail →</a>
</div>
</form>
</td>
</tr>
<?php endforeach;?>
</tbody>
</table>
</div>
<?php endif;?>

<?php if(!empty($rejected)):?>
<div class="ob-card">
<h2 style="font-size:16px;margin:0 0 12px;color:#F87171">Rejected (<?=count($rejected)?>)</h2>
<table class="ob-table">
<thead><tr><th>Obligation</th><th>Due</th><th>Status</th><th>Notes</th></tr></thead>
<tbody>
<?php foreach($rejected as $item):?>
<tr>
<td><strong><?=e($item['obligation_name']??'—')?></strong></td>
<td><?=e(date('M j, Y',strtotime($item['due_date'])))?></td>
<td><span class="ob-pill" style="background:rgba(239,68,68,.2);color:#FCA5A5">Rejected</span></td>
<td><?=e(mb_strimwidth($item['approver_notes']??'',0,200,'…'))?></td>
</tr>
<?php endforeach;?>
</tbody>
</table>
</div>
<?php endif;?>
</div>
<?php $content=ob_get_clean(); require __DIR__.'/../layouts/main.php'; ?>