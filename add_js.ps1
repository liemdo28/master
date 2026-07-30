$html = Get-Content 'd:\Project\Master\mi-core\ui\qb-dashboard.html' -Raw
if ($html -notmatch "function renderStores\b") {
    $js = @"
function renderStores() {
  fetch('/api/qb/mirror/stores').then(r=>r.json()).then(d=>{
    if(!d.ok||!d.stores||!d.stores.length){document.getElementById('ti-stores').innerHTML=noData('ti-stores','No stores found');return;}
    const t=d.totals||{};
    const rows=d.stores.map(s=>`<tr><td>`+esc(s.store||'—')+`</td><td>`+esc(s.company_name||'—')+`</td><td class="amount">`+fmtC(s.sales||0)+`</td><td class="amount">`+fmtC(s.ar||0)+`</td><td class="amount">`+fmtC(s.ap||0)+`</td><td class="amount">`+fmtC(s.cash||0)+`</td><td class="amount `+(s.net_income>=0?'green':'red')+`">`+fmtC(s.net_income||0)+`</td><td>`+fmtD(s.synced_at)+`</td></tr>`).join('');
    document.getElementById('ti-stores').innerHTML=`<div class="stat-row"><div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value green">`+fmtC(t.sales||0)+`</div></div><div class="stat"><div class="stat-label">A/R Outstanding</div><div class="stat-value amber">`+fmtC(t.ar||0)+`</div></div><div class="stat"><div class="stat-label">A/P Outstanding</div><div class="stat-value red">`+fmtC(t.ap||0)+`</div></div><div class="stat"><div class="stat-label">Cash Balance</div><div class="stat-value green">`+fmtC(t.cash||0)+`</div></div><div class="stat"><div class="stat-label">Net Income</div><div class="stat-value green">`+fmtC(t.net_income||0)+`</div></div></div><div class="table-scroll"><table><thead><tr><th>Store</th><th>Company</th><th class="amount">Revenue</th><th class="amount">A/R</th><th class="amount">A/P</th><th class="amount">Cash</th><th class="amount">Net Income</th><th>Last Synced</th></tr></thead><tbody>`+rows+`</tbody></table></div>`;
  }).catch(()=>document.getElementById('ti-stores').innerHTML=errMsg('Failed to load stores')); }
function renderStoreDetail() {
  const co=encodeURIComponent(document.getElementById('sel-company')?.value||'');
  fetch('/api/qb/mirror/store-report'+(co?'?company='+co:'')).then(r=>r.json()).then(d=>{
    if(!d.ok){document.getElementById('ti-store-detail').innerHTML=errMsg('Failed to load store report');return;}
    const pl=d.pl||{},bs=d.balance_sheet||{},ca=d.cash||{},ar=d.ar||{},ap=d.ap||{};
    const gm=pl.income?((pl.income-pl.cogs)/pl.income*100).toFixed(1)+'%':'—';
    document.getElementById('ti-store-detail').innerHTML=`<div class="stat-row"><div class="stat"><div class="stat-label">Revenue</div><div class="stat-value green">`+fmtC(pl.income||0)+`</div></div><div class="stat"><div class="stat-label">COGS</div><div class="stat-value red">`+fmtC(pl.cogs||0)+`</div></div><div class="stat"><div class="stat-label">Gross Margin</div><div class="stat-value">`+gm+`</div></div><div class="stat"><div class="stat-label">Net Income</div><div class="stat-value `+(pl.net>=0?'green':'red')+`">`+fmtC(pl.net||0)+`</div></div><div class="stat"><div class="stat-label">A/R Outstanding</div><div class="stat-value amber">`+fmtC(ar.total||0)+`</div><div class="stat-sub">`+(ar.count||0)+` invoices</div></div><div class="stat"><div class="stat-label">A/P Outstanding</div><div class="stat-value red">`+fmtC(ap.total||0)+`</div><div class="stat-sub">`+(ap.count||0)+` bills</div></div><div class="stat"><div class="stat-label">Cash</div><div class="stat-value">`+fmtC((ca.deposits||0)+(ca.checks||0))+`</div></div><div class="stat"><div class="stat-label">Total Assets</div><div class="stat-value">`+fmtC(bs.assets||0)+`</div></div></div>`;
  }).catch(()=>document.getElementById('ti-store-detail').innerHTML=errMsg('Failed to load')); }
function renderStoreRevenue() {
  const co=encodeURIComponent(document.getElementById('sel-company')?.value||'');
  fetch('/api/qb/mirror/store-revenue'+(co?'?company='+co:'')).then(r=>r.json()).then(d=>{
    if(!d.ok||!d.months||!d.months.length){document.getElementById('ti-store-revenue').innerHTML=noData('ti-store-revenue','No revenue data');return;}
    const rows=d.months.map(m=>`<tr><td>`+esc(m.month)+`</td><td class="amount">`+fmtC(m.receipts||0)+`</td><td class="amount">`+fmtC(m.paid_invoices||0)+`</td><td class="amount">`+fmtC(m.total||0)+`</td></tr>`).join('');
    document.getElementById('ti-store-revenue').innerHTML=`<div class="stat-row"><div class="stat"><div class="stat-label">Grand Total</div><div class="stat-value green">`+fmtC(d.grand_total||0)+`</div></div><div class="stat"><div class="stat-label">Periods</div><div class="stat-value">`+d.months.length+`</div></div></div><div class="table-scroll"><table><thead><tr><th>Month</th><th class="amount">Receipts</th><th class="amount">Paid Invoices</th><th class="amount">Total</th></tr></thead><tbody>`+rows+`</tbody></table></div>`;
  }).catch(()=>document.getElementById('ti-store-revenue').innerHTML=errMsg('Failed to load')); }
function renderStoreCompare() {
  fetch('/api/qb/mirror/store-compare').then(r=>r.json()).then(d=>{
    if(!d.ok||!d.stores||!d.stores.length){document.getElementById('ti-store-compare').innerHTML=noData('ti-store-compare','No stores found');return;}
    const rows=d.stores.map(s=>`<tr><td>`+esc(s.store||'—')+`</td><td class="amount">`+fmtC(s.sales||0)+`</td><td class="amount">`+fmtC(s.ar||0)+`</td><td class="amount">`+fmtC(s.ap||0)+`</td><td class="amount">`+fmtC(s.cash||0)+`</td><td class="amount `+(s.net_income>=0?'green':'red')+`">`+fmtC(s.net_income||0)+`</td><td class="amount">`+fmtC(s.total_assets||0)+`</td><td class="amount">`+fmtC(s.total_liabilities||0)+`</td><td class="amount">`+fmtC(s.total_equity||0)+`</td></tr>`).join('');
    document.getElementById('ti-store-compare').innerHTML=`<div class="table-scroll"><table><thead><tr><th>Store</th><th class="amount">Revenue</th><th class="amount">A/R</th><th class="amount">A/P</th><th class="amount">Cash</th><th class="amount">Net Income</th><th class="amount">Assets</th><th class="amount">Liabilities</th><th class="amount">Equity</th></tr></thead><tbody>`+rows+`</tbody></table></div>`;
  }).catch(()=>document.getElementById('ti-store-compare').innerHTML=errMsg('Failed to load')); }
"@
    $html = $html -replace "(case 'cfo': renderCfo\(\); break;)", "`$1`n$js"
    $html = $html -replace "(renderCfo\(\); break;)", "`$1`ncase 'stores': renderStores(); break;`ncase 'store-detail': renderStoreDetail(); break;`ncase 'store-revenue': renderStoreRevenue(); break;`ncase 'store-compare': renderStoreCompare(); break;"
    Write-Host "Added JS functions and switch cases"
} else {
    Write-Host "renderStores already exists"
}
Set-Content 'd:\Project\Master\mi-core\ui\qb-dashboard.html' -Value $html -NoNewline
Write-Host "Done"
