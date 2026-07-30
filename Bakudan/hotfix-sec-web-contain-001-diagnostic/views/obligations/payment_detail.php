<?php
$pageTitle='Payment Detail';
$currentPage='obligations';
ob_start();
$payment = $payment ?? [];
$obligation = $obligation ?? ['id'=>$payment['obligation_id'] ?? null,'name'=>$payment['obligation_name'] ?? 'Obligation'];
?>
<style>
.ob-wrap{max-width:1200px;margin:0 auto;padding:24px;color:#F1F5F9}.ob-card{background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:16px}.ob-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;border:none;cursor:pointer}.ob-btn-primary{background:#2563EB;color:#fff}.ob-btn-ghost{background:rgba(255,255,255,.06);color:#F1F5F9;border:1px solid rgba(255,255,255,.08)}.ob-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ob-field{background:#0F172A;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px}.ob-label{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px}.ob-note{white-space:pre-wrap;color:#CBD5E1}input{width:100%;padding:8px 10px;background:#0F172A;border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#F1F5F9;box-sizing:border-box}
</style>
<div class="ob-wrap">
<div style="margin-bottom:16px;color:#94A3B8;font-size:13px"><a href="<?=APP_URL?>/obligations" style="color:#60A5FA">Obligations</a> › <a href="<?=APP_URL?>/obligations/<?=(int)($obligation['id']??0)?>" style="color:#60A5FA"><?=e($obligation['name']??'Obligation')?></a> › Payment</div>
<div class="ob-card"><h2 style="margin:0 0 14px">Payment Detail</h2><div class="ob-grid">
<div class="ob-field"><div class="ob-label">Due Date</div><div><?=!empty($payment['due_date'])?e(date('M j, Y',strtotime($payment['due_date']))):'—'?></div></div>
<div class="ob-field"><div class="ob-label">Status</div><div><?=e($payment['status']??'pending')?></div></div>
<div class="ob-field"><div class="ob-label">Amount Due</div><div><?=isset($payment['amount'])&&$payment['amount']!==null?'$'.number_format((float)$payment['amount'],2):'—'?></div></div>
<div class="ob-field"><div class="ob-label">Amount Paid</div><div><?=isset($payment['paid_amount'])&&$payment['paid_amount']!==null?'$'.number_format((float)$payment['paid_amount'],2):'—'?></div></div>
<div class="ob-field"><div class="ob-label">Paid At</div><div><?=!empty($payment['paid_date'])?e(date('M j, Y',strtotime($payment['paid_date']))):'—'?></div></div>
<div class="ob-field"><div class="ob-label">Task</div><div><?php if(!empty($payment['task_id'])):?><a href="<?=APP_URL?>/tasks/<?=(int)$payment['task_id']?>" style="color:#60A5FA">Task #<?=(int)$payment['task_id']?></a><?php else:?>—<?php endif;?></div></div>
</div></div>
<div class="ob-card"><h2 style="margin:0 0 14px">Evidence + Review</h2>
<div class="ob-note">Reviewer notes: <?=e($payment['reviewer_notes']??'—')?>

Approver notes: <?=e($payment['approver_notes']??'—')?>

Invoice: <?=!empty($payment['evidence_invoice'])?'Yes':'No'?>
Receipt: <?=!empty($payment['evidence_receipt'])?'Yes':'No'?>
Bank Proof: <?=!empty($payment['evidence_bank_proof'])?'Yes':'No'?>
Payment Confirmation: <?=!empty($payment['evidence_payment_confirm'])?'Yes':'No'?>
</div></div>
<div class="ob-card"><h2 style="margin:0 0 14px">Record Payment</h2>
<form method="POST" action="<?=APP_URL?>/api/obligations/payment/<?=(int)$payment['id']?>">
<input type="hidden" name="csrf" value="<?=e(csrf_token())?>">
<div class="ob-grid">
<div><div class="ob-label">Amount Paid</div><input type="number" step="0.01" name="paid_amount" value="<?=e($payment['paid_amount']??'')?>"></div>
<div><div class="ob-label">Paid Date</div><input type="date" name="paid_date" value="<?=e($payment['paid_date']??'')?>"></div>
<div style="grid-column:1/-1"><div class="ob-label">Payment Reference</div><input name="payment_reference" value="<?=e($payment['payment_reference']??'')?>"></div>
</div>
<div style="margin-top:16px;display:flex;gap:8px"><button class="ob-btn ob-btn-primary" type="submit">Save Payment</button><a class="ob-btn ob-btn-ghost" href="<?=APP_URL?>/obligations/<?=(int)($obligation['id']??0)?>">Back to Obligation</a></div>
</form></div>
</div>
<?php $content=ob_get_clean(); require __DIR__.'/../layouts/main.php'; ?>
