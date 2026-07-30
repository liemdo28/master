<?php
$pageTitle = e($obl['name'] ?? 'Obligation Detail');
$currentPage = 'obligations';
ob_start();
?>
<style>
.ob-wrap{max-width:1280px;margin:0 auto;padding:24px;color:#F1F5F9}
.ob-card{background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:16px}
.ob-card h2{font-size:16px;font-weight:700;margin:0 0 14px}
.ob-kv{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ob-field{background:#0F172A;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px}
.ob-label{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px}
.ob-val{font-size:14px;color:#F1F5F9}
.ob-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;border:none;cursor:pointer}
.ob-btn-primary{background:#2563EB;color:#fff}
.ob-btn-ghost{background:rgba(255,255,255,.06);color:#F1F5F9;border:1px solid rgba(255,255,255,.08)}
.ob-btn-danger{background:#DC2626;color:#fff}
.ob-table{width:100%;border-collapse:collapse;font-size:13px}
.ob-table th{font-size:10px;color:#94A3B8;text-transform:uppercase;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
.ob-table td{padding:12px 8px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
.ob-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
.ob-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ob-form-grid .full{grid-column:1/-1}
.ob-form-grid label{font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;font-weight:700;display:block;margin-bottom:4px}
.ob-form-grid input,.ob-form-grid select,.ob-form-grid textarea{width:100%;padding:8px 10px;background:#0F172A;border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#F1F5F9;font-size:13px;box-sizing:border-box}
.flash{padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:13px}
.flash-success{background:rgba(34,197,94,.15);color:#86EFAC}
.flash-error{background:rgba(239,68,68,.15);color:#FCA5A5}
.ob-note{white-space:pre-wrap;color:#CBD5E1;font-size:13px;line-height:1.5}
</style>
<div class="ob-wrap">
<?php if($s=flash('success')):?><div class="flash flash-success"><?=e($s)?></div><?php endif;?>
<?php if($er=flash('error')):?><div class="flash flash-error"><?=e($er)?></div><?php endif;?>

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px">
<div><h1 style="font-size:22px;margin:0"><?=e($obl['name'])?></h1>
<p style="color:#94A3B8;font-size:13px;margin:4px 0 0"><?=e($obl['vendor']??'')?> · <?=e(ucfirst($obl['frequency']))?></p></div>
<div style="display:flex;gap:8px"><a class="ob-btn ob-btn-ghost" href="<?=APP_URL?>/obligations">← Back</a></div>
</div>

<div class="ob-card">
<h2>Details</h2>
<div class="ob-kv">
<div class="ob-field"><div class="ob-label">Category</div><div class="ob-val"><?=e($obl['category_name']??'—')?></div></div>
<div class="ob-field"><div class="ob-label">Store</div><div class="ob-val"><?=e($obl['store_label']??'—')?></div></div>
<div class="ob-field"><div class="ob-label">Frequency</div><div class="ob-val"><?=e(ucfirst(str_replace('_','-',$obl['frequency'])))?></div></div>
<div class="ob-field"><div class="ob-label">Due Day</div><div class="ob-val"><?=e($obl['due_day']??'—')?></div></div>
<div class="ob-field"><div class="ob-label">Due Month</div><div class="ob-val"><?=e($obl['due_month']??'—')?></div></div>
<div class="ob-field"><div class="ob-label">Grace Days</div><div class="ob-val"><?=e($obl['grace_days']??'0')?></div></div>
<div class="ob-field"><div class="ob-label">Amount</div><div class="ob-val"><?=$obl['amount']?'$'.number_format((float)$obl['amount'],2):'—'?></div></div>
<div class="ob-field"><div class="ob-label">Priority</div><div class="ob-val"><?=e(ucfirst($obl['priority']??'medium'))?></div></div>
<div class="ob-field"><div class="ob-label">Next Due</div><div class="ob-val"><?=$obl['next_due_date']?e(date('M j, Y',strtotime($obl['next_due_date']))):'—'?></div></div>
<div class="ob-field"><div class="ob-label">Active</div><div class="ob-val"><?=$obl['active']?'Yes':'No'?></div></div>
<div class="ob-field"><div class="ob-label">Reviewer</div><div class="ob-val"><?=e($obl['reviewer_name']??'—')?></div></div>
<div class="ob-field"><div class="ob-label">Approver</div><div class="ob-val"><?=e($obl['approver_name']??'—')?></div></div>
</div>
<?php if(!empty($obl['account_info'])):?>
<div style="margin-top:14px"><div class="ob-label">Account / Login Info</div><div class="ob-note"><?=e($obl['account_info'])?></div></div>
<?php endif;?>
<?php if(!empty($obl['compliance_note'])):?>
<div style="margin-top:14px"><div class="ob-label">Compliance Notes</div><div class="ob-note"><?=e($obl['compliance_note'])?></div></div>
<?php endif;?>
</div>

<div class="ob-card">
<h2>Payment History (<?=count($payments)?>)</h2>
<table class="ob-table"><thead><tr><th>Due Date</th><th>Period</th><th>Status</th><th>Amount Due</th><th>Amount Paid</th><th>Paid At</th><th>Task</th><th></th></tr></thead><tbody>
<?php if(empty($payments)):?><tr><td colspan="8" style="color:#94A3B8;text-align:center;padding:24px">No payments yet. Click "Generate Due Tasks" to create.</td></tr>
<?php else: foreach($payments as $p):?>
<tr>
<td><?=e(date('M j, Y',strtotime($p['due_date'])))?></td>
<td><?=e($p['period_label']??'—')?></td>
<td><span class="ob-pill" style="background:<?=match($p['status']??'pending'){'paid'=>'rgba(34,197,94,.2)','review'=>'rgba(59,130,246,.2)','approved'=>'rgba(168,85,247,.2)','overdue'=>'rgba(239,68,68,.2)',default=>'rgba(245,158,11,.2)'}?>"><?=e(ucfirst($p['status']??'pending'))?></span></td>
<td><?=$p['amount_due']?'$'.number_format((float)$p['amount_due'],2):'—'?></td>
<td><?=$p['amount_paid']?'$'.number_format((float)$p['amount_paid'],2):'—'?></td>
<td><?=$p['paid_at']?e(date('M j, Y',strtotime($p['paid_at']))):'—'?></td>
<td><?php if(!empty($p['task_id'])):?><a href="<?=APP_URL?>/tasks/<?=(int)$p['task_id']?>" style="color:#60A5FA">Task #<?=(int)$p['task_id']?></a><?php else:?>—<?php endif;?></td>
<td><a href="<?=APP_URL?>/obligations/payment/<?=(int)$p['id']?>" style="color:#60A5FA" data-detail-drawer>Detail →</a></td>
</tr>
<?php endforeach; endif;?></tbody></table>
</div>

<div class="ob-card">
<h2>Edit Obligation</h2>
<form method="POST" action="<?=APP_URL?>/obligations/<?=(int)$obl['id']?>">
<input type="hidden" name="csrf" value="<?=e(csrf_token())?>">
<div class="ob-form-grid">
<div class="full"><label>Name</label><input name="name" value="<?=e($obl['name'])?>" required></div>
<div><label>Category</label><select name="category_id"><?php foreach($categories as $c):?><option value="<?=(int)$c['id']?>" <?=(int)$c['id']===(int)$obl['category_id']?'selected':''?>><?=e($c['name'])?></option><?php endforeach;?></select></div>
<div><label>Store</label><select name="store_id"><option value="">— None —</option><?php foreach($stores as $s):?><option value="<?=(int)$s['id']?>" <?=(int)$s['id']===((int)($obl['store_id']??0))?'selected':''?>><?=e($s['name'])?></option><?php endforeach;?></select></div>
<div><label>Vendor</label><input name="vendor" value="<?=e($obl['vendor']??'')?>"></div>
<div><label>Frequency</label><select name="frequency"><?php foreach(['weekly','monthly','quarterly','semi_annual','annual'] as $f):?><option value="<?=$f?>" <?=$f===$obl['frequency']?'selected':''?>><?=e(ucfirst(str_replace('_','-',$f)))?></option><?php endforeach;?></select></div>
<div><label>Due Day</label><input name="due_day" type="number" min="1" max="31" value="<?=e($obl['due_day']??'')?>"></div>
<div><label>Due Month</label><input name="due_month" type="number" min="1" max="12" value="<?=e($obl['due_month']??'')?>"></div>
<div><label>Grace Days</label><input name="grace_days" type="number" min="0" max="60" value="<?=e($obl['grace_days']??'3')?>"></div>
<div><label>Amount</label><input name="amount" type="number" step="0.01" value="<?=e($obl['amount']??'')?>"></div>
<div><label>Priority</label><select name="priority"><?php foreach(['urgent','high','medium','low'] as $pr):?><option value="<?=$pr?>" <?=$pr===($obl['priority']??'high')?'selected':''?>><?=e(ucfirst($pr))?></option><?php endforeach;?></select></div>
<div><label>Reviewer</label><select name="reviewer_id"><option value="">— Default —</option><?php foreach($users as $u):?><option value="<?=(int)$u['id']?>" <?=(int)$u['id']===((int)($obl['reviewer_id']??0))?'selected':''?>><?=e($u['name'])?></option><?php endforeach;?></select></div>
<div><label>Approver</label><select name="approver_id"><option value="">— Default —</option><?php foreach($users as $u):?><option value="<?=(int)$u['id']?>" <?=(int)$u['id']===((int)($obl['approver_id']??0))?'selected':''?>><?=e($u['name'])?></option><?php endforeach;?></select></div>
<div class="full"><label>Account Info</label><textarea name="account_info"><?=e($obl['account_info']??'')?></textarea></div>
<div class="full"><label>Compliance Notes</label><textarea name="compliance_note"><?=e($obl['compliance_note']??'')?></textarea></div>
<div class="full"><label><input type="checkbox" name="active" value="1" <?=$obl['active']?'checked':''?>> Active</label></div>
</div>
<div style="margin-top:16px;display:flex;gap:8px">
<button type="submit" class="ob-btn ob-btn-primary">Save Changes</button>
<a href="<?=APP_URL?>/obligations" class="ob-btn ob-btn-ghost">Cancel</a>
</div>
</form>
</div>

<div class="ob-card">
<h2 style="color:#EF4444">Danger Zone</h2>
<form method="POST" action="<?=APP_URL?>/obligations/<?=(int)$obl['id']?>/delete" onsubmit="return confirm('Delete this obligation? This cannot be undone.')">
<input type="hidden" name="csrf" value="<?=e(csrf_token())?>">
<button type="submit" class="ob-btn ob-btn-danger">Delete Obligation</button>
</form>
</div>
</div>
<?php $content=ob_get_clean(); require __DIR__.'/../layouts/main.php'; ?>
