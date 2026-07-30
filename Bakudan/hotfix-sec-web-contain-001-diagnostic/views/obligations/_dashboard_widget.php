<?php
$oblKpis = $oblKpis ?? [];
$cards = [
    ['label'=>'Overdue Payments','icon'=>'🔴','count'=>(int)($oblKpis['overdue'] ?? 0),'link'=>APP_URL.'/obligations?filter=overdue'],
    ['label'=>'Due Next 30 Days','icon'=>'🟠','count'=>(int)($oblKpis['due_30'] ?? 0),'link'=>APP_URL.'/obligations?filter=upcoming'],
    ['label'=>'Missing Evidence','icon'=>'📎','count'=>(int)($oblKpis['missing_evidence'] ?? 0),'link'=>APP_URL.'/obligations/reviewer'],
    ['label'=>'Awaiting Approval','icon'=>'⏳','count'=>(int)($oblKpis['awaiting_approval'] ?? 0),'link'=>APP_URL.'/obligations/approver'],
    ['label'=>'Upcoming Tax Filings','icon'=>'🧾','count'=>(int)($oblKpis['tax_filings'] ?? $oblKpis['upcoming_tax'] ?? 0),'link'=>APP_URL.'/obligations?category=tax'],
    ['label'=>'Upcoming Renewals','icon'=>'📅','count'=>(int)($oblKpis['renewals'] ?? $oblKpis['upcoming_renewals'] ?? 0),'link'=>APP_URL.'/obligations?category=license'],
];
$color = static function(int $n): string { return $n >= 4 ? '#EF4444' : ($n >= 1 ? '#F59E0B' : '#22C55E'); };
?>
<style>
.obl-widget-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.obl-widget-card{background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px;text-decoration:none;color:#F1F5F9;display:block}.obl-widget-card:hover{border-color:rgba(96,165,250,.5)}.obl-widget-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94A3B8;font-weight:700}.obl-widget-count{font-size:28px;font-weight:800;line-height:1.1;margin-top:8px}.obl-widget-icon{font-size:20px}.obl-widget-row{display:flex;align-items:start;justify-content:space-between;gap:12px}.obl-widget-link{font-size:12px;color:#60A5FA;margin-top:8px}.@media(max-width:900px){.obl-widget-grid{grid-template-columns:1fr}}
</style>
<div class="obl-widget-grid">
<?php foreach($cards as $c): ?>
<a class="obl-widget-card" href="<?= e($c['link']) ?>">
  <div class="obl-widget-row"><div class="obl-widget-label"><?= e($c['label']) ?></div><div class="obl-widget-icon"><?= $c['icon'] ?></div></div>
  <div class="obl-widget-count" style="color:<?= $color((int)$c['count']) ?>"><?= (int)$c['count'] ?></div>
  <div class="obl-widget-link">Open →</div>
</a>
<?php endforeach; ?>
</div>
