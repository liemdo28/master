<?php
/** @var array $qbOverview */
/** @var array $importCoverage */
/** @var array $accountCoverage */
/** @var array $accountRows */
/** @var array $companyRows */
$title = "QuickBooks Data Freshness";
$adminOnly = true;
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=htmlspecialchars($title)?></title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;background:#f4f5f7;color:#1c1e21}
.wrap{max-width:1400px;margin:0 auto;padding:20px}
h1{font-size:18px;font-weight:600;margin-bottom:6px}
h2{font-size:14px;font-weight:600;margin:24px 0 10px;border-bottom:1px solid #e0e4e8;padding-bottom:5px}
.subtitle{color:#6b7280;font-size:12px;margin-bottom:20px}
.rows-summary{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.rows-summary .mini-stat{background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:8px 14px}
.rows-summary .mini-stat .lbl{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px}
.rows-summary .mini-stat .val{font-size:16px;font-weight:700;margin-top:2px}
.info-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax:160px,1fr);gap:8px;margin-top:8px}
.info-item{background:#f9fafb;border:1px solid #f3f4f6;border-radius:5px;padding:8px 10px}
.info-item .label{font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px}
.info-item .value{font-size:13px;font-weight:600}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.badge-fresh{background:#dcfce7;color:#166534}
.badge-stale{background:#fef9c3;color:#854d0e}
.badge-blocked{background:#fee2e2;color:#991b1b}
.badge-missing{background:#f3f4f6;color:#6b7280}
.badge-unk{background:#ede9fe;color:#5b21b6}
.alert{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;font-size:12px;margin-bottom:12px;color:#92400e}
.alert-warn{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.alert-ok{background:#dcfce7;border-color:#86efac;color:#166534}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{background:#f8fafc;text-align:left;padding:7px 10px;border-bottom:2px solid #e5e7eb;font-weight:600;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
tbody td{padding:7px 10px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
tbody tr:hover{background:#f9fafb}
.num{text-align:right;font-variant-numeric:tabular-nums}
.text-sm{font-size:11px}
.text-muted{color:#9ca3af}
.no-data{color:#9ca3af;font-style:italic}
.section-note{font-size:11px;color:#6b7280;margin-bottom:12px;line-height:1.5}
.tag{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px}
.tag-bank{background:#dbeafe;color:#1e40af}
.tag-cc{background:#fce7f3;color:#9d174d}
.tag-inc{background:#d1fae5;color:#065f46}
.tag-exp{background:#fee2e2;color:#991b1b}
.tag-other{background:#f3f4f6;color:#6b7280}
.acct-filter-wrap{margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.acct-filter-wrap select{padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px}
.filter-btn{padding:4px 10px;border:1px solid #d1d5db;border-radius:20px;font-size:11px;background:#fff;color:#374151;text-decoration:none}
.filter-btn:hover{background:#1f2937;color:#fff;border-color:#1f2937}
.acct-table-wrap{max-height:500px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px}
</style>
</head>
<body>
<div class="wrap">
<h1>QuickBooks Data Freshness</h1>
<p class="subtitle">Source: <?=htmlspecialchars($qbOverview['cache_source'] ?? 'Unknown')?> &nbsp;&bull;&nbsp; Generated: <?=$qbOverview['generated_at'] ? htmlspecialchars($qbOverview['generated_at']) : '<span class="no-data">not available</span>'?></p>
<?php
function qb_badge(string $s): string { $c=match($s){'fresh'=>'badge-fresh','stale'=>'badge-stale','blocked'=>'badge-blocked','missing'=>'badge-missing','unknown'=>'badge-unk',default=>'badge-missing'}; return '<span class="badge '.$c.'">'.ucfirst($s).'</span>'; }
function qb_esc(string $s): string { return htmlspecialchars($s,ENT_QUOTES,'UTF-8'); }
function qb_fdate(?string $d): string { if(!$d) return '<span class="no-data">---</span>'; $t=strtotime($d); return $t ? date('Y-m-d',$t) : '<span class="no-data">Invalid</span>'; }
function qb_tcls(string $t): string { $l=strtolower($t); if(strpos($l,'bank')!==false) return 'bank'; if(strpos($l,'creditcard')!==false||strpos($l,'credit card')!==false) return 'cc'; if(stripos($t,'Income')!==false) return 'inc'; if(stripos($t,'Expense')!==false) return 'exp'; return 'other'; }
$certified=(bool)($qbOverview['certified']??false); $coverageOk=(bool)($qbOverview['coverage_ok']??false); $certGreen=(bool)($qbOverview['certified_green']??false);
if($certified&&$certGreen){echo '<div class="alert alert-ok">&#10003; QuickBooks data is fully certified and coverage is green.</div>';}
elseif($certified&&!$certGreen){echo '<div class="alert">&#9432; QB data is certified but coverage is not green.</div>';}
elseif(!$certified&&$coverageOk){echo '<div class="alert alert-warn">&#9888; Import coverage passed, but runtime certification still has separate gaps. QB data may not be fully ready for all workflows.</div>';}
elseif(!$certified){echo '<div class="alert alert-warn">&#10060; QuickBooks data is not certified. Coverage: '.($coverageOk?'OK':'FAILED').'</div>';}
?>
<h2>QuickBooks Overview</h2>
<div class="rows-summary">
  <div class="mini-stat"><div class="lbl">Total Accounts</div><div class="val"><?=number_format($qbOverview['total_accounts'] ?? 0)?></div></div>
  <div class="mini-stat"><div class="lbl">Bank Accounts</div><div class="val"><?=number_format($qbOverview['total_bank_accounts'] ?? 0)?></div></div>
  <div class="mini-stat"><div class="lbl">Credit Card Accts</div><div class="val"><?=number_format($qbOverview['total_credit_card_accounts'] ?? 0)?></div></div>
  <div class="mini-stat"><div class="lbl">Income Accounts</div><div class="val"><?=number_format($qbOverview['total_income_accounts'] ?? 0)?></div></div>
  <div class="mini-stat"><div class="lbl">Expense Accounts</div><div class="val"><?=number_format($qbOverview['total_expense_accounts'] ?? 0)?></div></div>
</div>
<div class="info-grid">
  <div class="info-item"><div class="label">Last sync</div><div class="value"><?=qb_fdate($qbOverview['last_sync_timestamp'] ?? null)?></div></div>
  <div class="info-item"><div class="label">Sync status</div><div class="value"><?=qb_badge($qbOverview['last_sync_status'] ?? 'unknown')?></div></div>
  <div class="info-item"><div class="label">Coverage OK</div><div class="value"><?=qb_badge($coverageOk ? 'fresh' : 'missing')?></div></div>
  <div class="info-item"><div class="label">Certified green</div><div class="value"><?=qb_badge($certGreen ? 'fresh' : 'missing')?></div></div>
  <div class="info-item"><div class="label">Overall certified</div><div class="value"><?=qb_badge($certified ? 'fresh' : ($coverageOk ? 'stale' : 'blocked'))?></div></div>
  <div class="info-item"><div class="label">Latest sales receipt</div><div class="value"><?=qb_fdate($qbOverview['latest_sales_receipt_date'] ?? null)?></div></div>
  <div class="info-item"><div class="label">Latest bank txn</div><div class="value"><?=qb_fdate($qbOverview['latest_bank_transaction_date'] ?? null)?></div></div>
  <div class="info-item"><div class="label">Latest CC txn</div><div class="value"><?=qb_fdate($qbOverview['latest_credit_card_transaction_date'] ?? null)?></div></div>
</div>

<h2>Per-Company Data Freshness</h2>
<p class="section-note">Breakdown by QuickBooks company file (each = one store/location). Grouped via company_file_id from /api/qb/mirror/accounts.</p>
<div class="rows-summary">
  <div class="mini-stat"><div class="lbl">Company Files</div><div class="val"><?=count($companyRows ?: [])?></div></div>
  <div class="mini-stat"><div class="lbl">Total Accounts</div><div class="val"><?=number_format(array_sum(array_column($companyRows ?: [], 'total_accounts')))?></div></div>
  <div class="mini-stat"><div class="lbl">Total Bank Accts</div><div class="val"><?=number_format(array_sum(array_column($companyRows ?: [], 'bank_accounts')))?></div></div>
  <div class="mini-stat"><div class="lbl">Total CC Accts</div><div class="val"><?=number_format(array_sum(array_column($companyRows ?: [], 'cc_accounts')))?></div></div>
</div>
<table><thead><tr><th>Store</th><th>Company File</th><th>Machine</th><th class="num">Total</th><th class="num">Bank</th><th class="num">CC</th><th class="num">Income</th><th class="num">Expense</th><th>Last Sync</th><th>Status</th></tr></thead><tbody>
<?php if(empty($companyRows)): ?>
<tr><td colspan="10" class="no-data">No company data available. Check Mi API connectivity.</td></tr>
<?php else: foreach($companyRows as $co): ?>
<tr>
  <td><strong><?=qb_esc($co['store_name'] ?? 'unknown')?></strong></td>
  <td class="text-sm text-muted" title="<?=qb_esc($co['company_path'] ?? '')?>"><?=qb_esc($co['company_name'] ?? 'Unknown')?></td>
  <td class="text-sm text-muted"><?=qb_esc($co['machine_id'] ?? '&mdash;')?></td>
  <td class="num"><?=number_format($co['total_accounts'] ?? 0)?></td>
  <td class="num"><?=number_format($co['bank_accounts'] ?? 0)?></td>
  <td class="num"><?=number_format($co['cc_accounts'] ?? 0)?></td>
  <td class="num"><?=number_format($co['income_accounts'] ?? 0)?></td>
  <td class="num"><?=number_format($co['expense_accounts'] ?? 0)?></td>
  <td class="text-sm"><?=qb_fdate($co['last_sync_at'] ?? null)?></td>
  <td><?=qb_badge($co['sync_status'] ?? 'missing')?></td>
</tr>
<?php endforeach; endif; ?>
</tbody></table>

<h2>Import Coverage</h2>
<p class="section-note">Data from Mi API /api/qb/mirror/summary and /api/visibility/quickbooks.</p>
<table><thead><tr><th>Data type</th><th class="num">Records imported</th><th>Latest date</th><th>Status</th><th>Source</th></tr></thead><tbody>
<?php foreach($importCoverage as $row): ?>
<tr>
  <td><?=qb_esc($row['data_type'])?></td>
  <td class="num"><?=number_format($row['records'])?></td>
  <td><?=qb_fdate($row['latest_date'])?></td>
  <td><?=qb_badge($row['status'])?></td>
  <td class="text-sm text-muted"><?=qb_esc($row['source'])?></td>
</tr>
<?php endforeach; ?>
</tbody></table>

<h2>Chart of Accounts Coverage</h2>
<p class="section-note">Account counts by QB type. Required minimum: 1 for Bank and Credit Card.</p>
<table><thead><tr><th>Account type</th><th class="num">Count</th><th class="num">Min expected</th><th>Status</th></tr></thead><tbody>
<?php
$total=0;
foreach($accountCoverage as $row){$cnt=(int)($row['count']??0);$min=(int)($row['min_expected']??0);$total+=$cnt;echo'<tr><td>'.qb_esc($row['type']??'Unknown').'</td><td class="num">'.number_format($cnt).'</td><td class="num">'.($min?number_format($min):'&mdash;').'</td><td>'.qb_badge($row['status']??'missing').'</td></tr>';}
echo'<tr style="font-weight:700;background:#f8fafc"><td>Total</td><td class="num">'.number_format($total).'</td><td class="num">&mdash;</td><td>'.qb_badge($total>0?'fresh':'missing').'</td></tr>';
?>
</tbody></table>

<h2>Per-Account Freshness</h2>
<p class="section-note">Individual accounts from qb-mirror.db with balance, last txn date, and sync time. Filterable.</p>
<?php
$filter=$_GET['filter']??'';
$allTypes=array_unique(array_column($accountRows,'classification'));
sort($allTypes);
$filtered=$filter?array_filter($accountRows,fn($r)=>($r['classification']??'')===$filter):$accountRows;
$totalBal=array_sum(array_filter(array_column($filtered,'balance'),fn($v)=>$v!==null));
?>
<div class="acct-filter-wrap">
  <form method="get">
    <label>Filter:</label>
    <select name="filter" onchange="this.form.submit()">
      <option value="">All (<?=count($accountRows)?>)</option>
      <?php foreach($allTypes as $t): $cnt=count(array_filter($accountRows,fn($r)=>($r['classification']??'')===$t)); ?>
      <option value="<?=qb_esc($t)?>" <?=$filter===$t?'selected':''?>><?=qb_esc($t)?> (<?=$cnt?>)</option>
      <?php endforeach; ?>
    </select>
  </form>
  <?php if($filter): ?><a href="?" class="filter-btn">Clear filter</a><?php endif; ?>
</div>
<p class="section-note">Showing <?=count($filtered)?> of <?=count($accountRows)?> accounts.<?php if($totalBal!=0):?> Total balance: <strong>$<?=number_format($totalBal,2)?></strong>.<?php endif;?></p>
<div class="acct-table-wrap">
<table><thead><tr><th>Account name</th><th>Account number</th><th>Classification</th><th class="num">Balance</th><th>Last txn date</th><th>Last sync</th><th>Status</th></tr></thead><tbody>
<?php if(empty($filtered)): ?>
<tr><td colspan="7" class="no-data">No accounts loaded from qb-mirror.db. Mirror DB may not be accessible from this host.</td></tr>
<?php else:
$today=time();
foreach($filtered as $row):
$lastTxn=$row['last_transaction_date']??null;
$lastSync=$row['last_sync_at']??null;
$statusDate=$lastTxn?:$lastSync;
$txnDays=$statusDate?($today-strtotime($statusDate))/86400:null;
$txnSt=$statusDate?($txnDays<=30?'fresh':($txnDays<=90?'stale':'blocked')):'missing';
?>
<tr>
  <td><?=qb_esc($row['name']??'Unnamed')?></td>
  <td class="text-muted"><?=$row['account_number']?qb_esc($row['account_number']):'<span class="no-data">&mdash;</span>'?></td>
  <td><span class="tag tag-<?=qb_tcls($row['account_type']??'')?>"><?=qb_esc($row['classification']??'Other')?></span></td>
  <td class="num"><?=$row['balance']!==null?'$'.number_format($row['balance'],2):'<span class="no-data">&mdash;</span>'?></td>
  <td><?=qb_fdate($lastTxn)?></td>
  <td class="text-sm"><?=qb_fdate($lastSync)?></td>
  <td><?=qb_badge($txnSt)?></td>
</tr>
<?php endforeach; ?>
<?php endif; ?>
</tbody></table>
</div>
</div><!-- .wrap -->
<script>
(function(){
  const MI_BASE = 'http://127.0.0.1:4001';
  const wrap = document.querySelector('.wrap');
  if (!wrap || !window.fetch) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = n => Number(n || 0).toLocaleString('en-US');
  const money = n => n === null || n === undefined || n === '' ? '---' : '$' + Number(n || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const fdate = d => d ? String(d).slice(0, 10) : '---';
  const badge = s => {
    const cls = {fresh:'badge-fresh', stale:'badge-stale', blocked:'badge-blocked', missing:'badge-missing', unknown:'badge-unk'}[s] || 'badge-missing';
    return `<span class="badge ${cls}">${esc(String(s || 'missing').replace(/^./, m => m.toUpperCase()))}</span>`;
  };
  const statusByDate = d => {
    if (!d) return 'missing';
    const t = Date.parse(d);
    if (!Number.isFinite(t)) return 'missing';
    const days = (Date.now() - t) / 86400000;
    if (days <= 30) return 'fresh';
    if (days <= 90) return 'stale';
    return 'blocked';
  };
  const classify = type => {
    const t = String(type || '').toLowerCase();
    if (t.includes('creditcard')) return 'Credit Card';
    if (t.includes('bank')) return 'Bank';
    if (t.includes('income')) return 'Income';
    if (t.includes('expense')) return 'Expense';
    return 'Other';
  };
  const tagClass = type => {
    const t = String(type || '').toLowerCase();
    if (t.includes('bank')) return 'bank';
    if (t.includes('creditcard') || t.includes('credit card')) return 'cc';
    if (t.includes('income')) return 'inc';
    if (t.includes('expense')) return 'exp';
    return 'other';
  };
  async function api(path) {
    const r = await fetch(MI_BASE + path, {cache:'no-store'});
    if (!r.ok) throw new Error(path + ' ' + r.status);
    return r.json();
  }
  function render(ctx) {
    const visibility = ctx.visibility || {};
    const coa = visibility.chart_of_accounts || visibility.summary || {};
    const mirror = (ctx.mirror && ctx.mirror.summary) || {};
    const accounts = (ctx.accounts && ctx.accounts.accounts) || [];
    const counts = coa.account_counts_by_type || {};
    const certified = !!visibility.certified;
    const coverageOk = !!coa.coverage_ok;
    const certGreen = !!coa.certified_green;
    const alert = certified && certGreen
      ? '<div class="alert alert-ok">&#10003; QuickBooks data is fully certified and coverage is green.</div>'
      : (!certified && coverageOk
        ? '<div class="alert alert-warn">&#9888; Import coverage passed, but runtime certification still has separate gaps. QB data may not be fully ready for all workflows.</div>'
        : '<div class="alert alert-warn">&#10060; QuickBooks data is not certified. Coverage: ' + (coverageOk ? 'OK' : 'FAILED') + '</div>');
    const importRows = [
      ['Chart of Accounts', coa.total_accounts || mirror.accounts, coa.latest_account_sync_at, coverageOk ? 'fresh' : 'missing', 'chart_of_accounts / qb-mirror.db'],
      ['Sales Receipts', mirror.sales_receipts, coa.latest_sales_receipt_date, statusByDate(coa.latest_sales_receipt_date), 'SalesReceipt / qb-mirror.db'],
      ['Checks', mirror.checks, coa.latest_bank_transaction_date, mirror.checks ? statusByDate(coa.latest_bank_transaction_date) : 'missing', 'Check / qb-mirror.db'],
      ['Deposits', mirror.deposits, coa.latest_bank_transaction_date, mirror.deposits ? statusByDate(coa.latest_bank_transaction_date) : 'missing', 'Deposit / qb-mirror.db'],
      ['Credit Card Charges', mirror.credit_card_charges, coa.latest_credit_card_transaction_date, mirror.credit_card_charges ? statusByDate(coa.latest_credit_card_transaction_date) : 'missing', 'CreditCardCharge / qb-mirror.db'],
      ['Credit Card Credits', mirror.credit_card_credits, coa.latest_credit_card_transaction_date, mirror.credit_card_credits ? statusByDate(coa.latest_credit_card_transaction_date) : 'missing', 'CreditCardCredit / qb-mirror.db'],
      ['Bank Accounts', coa.total_bank_accounts, coa.latest_bank_transaction_date, coa.total_bank_accounts ? statusByDate(coa.latest_bank_transaction_date) : 'missing', 'chart_of_accounts type=Bank'],
      ['Credit Card Accounts', coa.total_credit_card_accounts, coa.latest_credit_card_transaction_date, coa.total_credit_card_accounts ? statusByDate(coa.latest_credit_card_transaction_date) : 'missing', 'chart_of_accounts type=CreditCard'],
    ];
    const types = [['Bank','Bank',1],['Credit Card','CreditCard',1],['Income','Income',0],['Expense','Expense',0],['Accounts Receivable','AccountsReceivable',0],['Accounts Payable','AccountsPayable',0],['Cost of Goods Sold','CostOfGoodsSold',0],['Equity','Equity',0],['Fixed Asset','FixedAsset',0],['Long Term Liability','LongTermLiability',0],['Other Asset','OtherAsset',0],['Other Current Asset','OtherCurrentAsset',0],['Other Current Liability','OtherCurrentLiability',0],['Other Expense','OtherExpense',0],['Other Income','OtherIncome',0]];
    let totalTypes = 0;
    const accountRows = accounts.map(a => {
      const classification = classify(a.account_type);
      const txn = classification === 'Bank' ? coa.latest_bank_transaction_date : (classification === 'Credit Card' ? coa.latest_credit_card_transaction_date : null);
      return {
        name: a.full_name || a.name || 'Unnamed',
        number: a.account_number || '',
        type: a.account_type || 'Unknown',
        classification,
        balance: a.total_balance ?? a.balance,
        txn,
        sync: a.synced_at || coa.latest_account_sync_at
      };
    }).sort((a,b) => (a.classification + a.name).localeCompare(b.classification + b.name));
    const groups = [...new Set(accountRows.map(a => a.classification))].sort();
    function accountTable(filter) {
      const rows = filter ? accountRows.filter(a => a.classification === filter) : accountRows;
      const totalBal = rows.reduce((s,a) => s + Number(a.balance || 0), 0);
      return `
        <div class="acct-filter-wrap">
          <label>Filter:</label>
          <select id="qb-client-filter">
            <option value="">All (${accountRows.length})</option>
            ${groups.map(g => `<option value="${esc(g)}" ${filter===g?'selected':''}>${esc(g)} (${accountRows.filter(a => a.classification === g).length})</option>`).join('')}
          </select>
        </div>
        <p class="section-note">Showing ${rows.length} of ${accountRows.length} accounts.${totalBal ? ' Total balance: <strong>' + money(totalBal) + '</strong>.' : ''}</p>
        <div class="acct-table-wrap"><table><thead><tr><th>Account name</th><th>Account number</th><th>Classification</th><th class="num">Balance</th><th>Last txn date</th><th>Last sync</th><th>Status</th></tr></thead><tbody>
        ${rows.length ? rows.map(a => `<tr><td>${esc(a.name)}</td><td class="text-muted">${a.number ? esc(a.number) : '<span class="no-data">---</span>'}</td><td><span class="tag tag-${tagClass(a.type)}">${esc(a.classification)}</span></td><td class="num">${money(a.balance)}</td><td>${fdate(a.txn)}</td><td class="text-sm">${fdate(a.sync)}</td><td>${badge(statusByDate(a.txn || a.sync))}</td></tr>`).join('') : '<tr><td colspan="7" class="no-data">No accounts loaded.</td></tr>'}
        </tbody></table></div>`;
    }
    wrap.innerHTML = `
      <h1>QuickBooks Data Freshness</h1>
      <p class="subtitle">Source: Mi local API via browser &bull; Generated: ${esc(visibility.generated_at || new Date().toISOString())}</p>
      ${alert}
      <h2>QuickBooks Overview</h2>
      <div class="rows-summary">
        <div class="mini-stat"><div class="lbl">Total Accounts</div><div class="val">${num(coa.total_accounts)}</div></div>
        <div class="mini-stat"><div class="lbl">Bank Accounts</div><div class="val">${num(coa.total_bank_accounts)}</div></div>
        <div class="mini-stat"><div class="lbl">Credit Card Accts</div><div class="val">${num(coa.total_credit_card_accounts)}</div></div>
        <div class="mini-stat"><div class="lbl">Income Accounts</div><div class="val">${num(coa.total_income_accounts)}</div></div>
        <div class="mini-stat"><div class="lbl">Expense Accounts</div><div class="val">${num(coa.total_expense_accounts)}</div></div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="label">Last sync</div><div class="value">${fdate(visibility.last_sync_timestamp || visibility.last_successful_sync)}</div></div>
        <div class="info-item"><div class="label">Sync status</div><div class="value">${badge(String(visibility.last_sync_status || 'unknown').toLowerCase()==='success'?'fresh':'unknown')}</div></div>
        <div class="info-item"><div class="label">Coverage OK</div><div class="value">${badge(coverageOk?'fresh':'missing')}</div></div>
        <div class="info-item"><div class="label">Certified green</div><div class="value">${badge(certGreen?'fresh':'missing')}</div></div>
        <div class="info-item"><div class="label">Overall certified</div><div class="value">${badge(certified?'fresh':(coverageOk?'stale':'blocked'))}</div></div>
        <div class="info-item"><div class="label">Latest sales receipt</div><div class="value">${fdate(coa.latest_sales_receipt_date)}</div></div>
        <div class="info-item"><div class="label">Latest bank txn</div><div class="value">${fdate(coa.latest_bank_transaction_date)}</div></div>
        <div class="info-item"><div class="label">Latest CC txn</div><div class="value">${fdate(coa.latest_credit_card_transaction_date)}</div></div>
      </div>
      <h2>Per-Account Freshness</h2>
      <p class="section-note">Individual accounts from Mi local API with balance, last txn date, and sync time. Filterable.</p>
      <div id="qb-client-accounts">${accountTable('')}</div>`;
    const bindAccountFilter = () => {
      const select = document.getElementById('qb-client-filter');
      if (!select) return;
      select.addEventListener('change', () => {
        document.getElementById('qb-client-accounts').innerHTML = accountTable(select.value);
        bindAccountFilter();
      });
    };
    bindAccountFilter();
  }
  Promise.all([
    api('/api/visibility/quickbooks'),
    api('/api/qb/mirror/summary'),
    api('/api/qb/mirror/accounts')
  ]).then(([visibility, mirror, accounts]) => render({visibility, mirror, accounts})).catch(err => {
    const note = document.createElement('div');
    note.className = 'alert alert-warn';
    note.textContent = 'Browser could not reach Mi local API at ' + MI_BASE + ': ' + err.message;
    wrap.insertBefore(note, wrap.firstChild);
  });
})();
</script>
</body>
</html>
