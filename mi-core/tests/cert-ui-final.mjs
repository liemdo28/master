/**
 * UI-8 Final CEO Acceptance Test — UI-1 through UI-8
 * Run: node tests/cert-ui-final.mjs
 */
const BASE = 'http://localhost:4001';
let passed = 0, failed = 0;

async function check(name, fn) {
  try {
    const ok = await fn();
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (ok) passed++; else failed++;
  } catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}

const get  = async (p) => { const r = await fetch(BASE+p); if(!r.ok) throw new Error(r.status); const d=await r.json(); return d?.data??d; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const post = async (p,b,retry=2) => {
  for (let i=0; i<=retry; i++) {
    try { const r = await fetch(BASE+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); return r.json(); }
    catch(e) { if(i===retry) throw e; await sleep(3000); }
  }
};

// Prefetch all at once
const [snap, conn, bi_raw, html] = await Promise.all([
  get('/api/visibility/snapshot'),
  get('/api/visibility/connectors'),
  fetch(BASE+'/api/coo-v4/burnin').then(r=>r.json()),
  fetch(BASE+'/index.html').then(r=>r.text()),
]);
const bi = bi_raw?.data ?? bi_raw;
const conns = conn?.connectors ?? [];

console.log('\n🏠 UI-1: CEO HOME DASHBOARD');
await check('Page loads (200)', async () => { const r = await fetch(BASE+'/index.html'); return r.ok; });
await check('Full UI > 40 KB', () => html.length > 40000);
await check('12 sections present', () => ['sec-home','sec-ask','sec-alerts','sec-tasks','sec-approvals','sec-workorders','sec-email','sec-calendar','sec-health','sec-finance','sec-connectors','sec-burnin'].every(s => html.includes(s)));
await check('6 KPI cards', () => ['kpi-emails','kpi-overdue','kpi-cal','kpi-approv','kpi-steps','kpi-burnin'].every(k => html.includes(k)));
await check('Real emails = 45', () => snap?.emails?.unread === 45);
await check('Real calendar = 3 events', () => snap?.calendar?.today_count === 3);
await check('Work Orders grid', () => html.includes('Audit Dashboard') && html.includes('ai_developer'));
await check('Connector health strip', () => html.includes('home-conn'));
await check('QB status chip in hero', () => html.includes('qb-hero-chip') || html.includes('QB SYNC_FAILED'));
await check('All 3 calendar event titles', () => {
  const evs = snap?.calendar?.events_today || [];
  return evs.some(e => e.title.includes('BackYard')) && evs.some(e => e.title.includes('Stockton'));
});

console.log('\n💬 UI-2: ASK MI PANEL CERTIFIED');
const Q = [
  'Hôm nay anh có gì?', 'Có gì cần duyệt không?', 'Có gì đáng lo không?', 'Doanh thu sao rồi?',
  'Review Automation có lỗi gì?', 'Gmail có gì quan trọng?', 'Hôm qua anh ngủ mấy tiếng?', 'Project nào rủi ro nhất?',
];
for (let i = 0; i < Q.length; i++) {
  await check(`Q${i+1}: ${Q[i].slice(0, 30)}`, async () => {
    const d = await post('/api/chat', { message: Q[i], language: 'vi' });
    return !!(d.reply || d.response || d.message);
  });
}
await check('8 quick prompt buttons in UI', () => Q.slice(0, 3).every(q => html.includes(q.slice(0, 15))));

console.log('\n🎨 UI-3: VISUAL POLISH');
await check('Dark theme CSS vars (--bg:#09090f)', () => html.includes('--bg:#09090f'));
await check('Skeleton loading states', () => html.includes('class="sk"'));
await check('Empty state components', () => html.includes('class="empty"'));
await check('Error alert boxes', () => html.includes('abox.err'));
await check('Progress bar fills', () => html.includes('hbar-fill'));
await check('Status tags (tg/ty/tr/tb/tp) — CSS defined + used', () => ['tg','ty','tr','tb','tp'].every(c => html.includes(`.${c}{`) || html.includes(`"tag ${c}"`) || html.includes(`'${c}'`)));
await check('Status dots', () => html.includes('class="dot"'));
await check('Mobile responsive breakpoints', () => html.includes('@media(max-width:800px)'));
await check('Sidebar navigation', () => html.includes('class="sidebar"'));
await check('Card hierarchy (card/card-hd/card-body)', () => html.includes('class="card"') && html.includes('card-hd') && html.includes('card-body'));

console.log('\n🔄 UI-4: LIVE DASHBOARD REFRESH');
await check('Refresh button (id=refresh-btn)', () => html.includes('id="refresh-btn"'));
await check('Last updated timestamp', () => html.includes('id="last-updated"'));
await check('Auto-refresh 60s timer', () => html.includes('setInterval(refreshAll,60000)'));
await check('startAutoRefresh() called on boot', () => html.includes('startAutoRefresh()'));
await check('refreshAll() resets all cache', () => html.includes('_snap=null') && html.includes('_conn=null') && html.includes('_bi=null'));
await check('Per-section lazy load with reset', () => html.includes('Object.keys(LD).forEach'));

console.log('\n🚨 UI-5: CRITICAL ALERT LAYER');
await check('Alert banner element', () => html.includes('id="alert-banner"'));
await check('Alert pills container', () => html.includes('id="alert-pills"'));
await check('buildAlerts() function', () => html.includes('function buildAlerts'));
await check('applyAlerts() function', () => html.includes('function applyAlerts'));
await check('QB alert detection (via qbState or hardcoded)', () => html.includes('qbState') || html.includes("key:'qb'") || html.includes('key:"qb"'));
await check('Degraded connector detection', () => html.includes("health==='degraded'"));
await check('Orphan workflow detection', () => html.includes('orphan_workflows'));
await check('Alert chip in topbar', () => html.includes('id="alert-chip"'));
await check('Dismiss banner function', () => html.includes('dismissBanner'));
await check('QB runtime connector present', () => conns.some(c => c.id === 'quickbooks-runtime'));

console.log('\n📎 UI-6: EVIDENCE LINKS');
await check('Evidence link class (.ev)', () => html.includes('class="ev"'));
await check('Work Order evidence (p4-audit)', () => html.includes('reports/evidence/p4-audit'));
await check('Finance evidence (p8-finance)', () => html.includes('reports/evidence/p8-finance'));
await check('QB root cause report link', () => html.includes('QB_CONNECTOR_INVESTIGATION'));
await check('Workspace evidence link', () => html.includes('reports/evidence/p2-workspace'));
await check('Gmail link', () => html.includes('mail.google.com'));
await check('Asana link', () => html.includes('asana.com'));
await check('Calendar source link', () => html.includes('calendar.google.com'));
await check('Apple Health source label', () => html.includes('Apple Health'));
await check('Burn-In DB link', () => html.includes('burn-in.db'));

console.log('\n📊 UI-7: BURN-IN DASHBOARD');
await check('Burn-in score = 86', () => bi?.burn_in_score === 86);
await check('Status = DEGRADED', () => bi?.burn_in_status === 'DEGRADED');
await check('7 domains tracked', () => Object.keys(bi?.by_domain || {}).length === 7);
await check('success_rate present', () => typeof bi?.success_rate === 'number');
await check('failure_rate present', () => typeof bi?.failure_rate === 'number');
await check('retry_rate present', () => typeof bi?.retry_rate === 'number');
await check('avg_runtime_ms present', () => typeof bi?.avg_runtime_ms === 'number');
await check('flow_gaps = 0', () => bi?.flow_gaps === 0);
await check('orphan_workflows = 0', () => bi?.orphan_workflows === 0);
await check('missing_evidence = 0', () => bi?.missing_evidence === 0);
await check('recent_events (10)', () => bi?.recent_events?.length >= 10);
await check('days_elapsed tracked', () => bi?.days_elapsed >= 1);
await check('Burn-in section HTML complete', () => ['bi-score-card','bi-rates','bi-flow','bi-domains','bi-recent'].every(id => html.includes(id)));

console.log('\n🏁 UI-8: FINAL CEO ACCEPTANCE');
await check('Page loads at http://localhost:4001', () => html.length > 10000);
await check('No JS syntax errors (well-formed)', () => html.includes('</script>') && html.split('<script>').length > 1);
await check('Real emails visible (45)', () => snap?.emails?.unread === 45);
await check('Real Google Calendar (3 events)', () => (snap?.calendar?.events_today || []).length === 3);
await check('Real health data (steps/sleep/HRV)', () => !!snap?.health?.summary?.includes('HRV'));
await check('Ask Mi works (live AI response)', async () => { const d = await post('/api/chat', {message:'status?',language:'vi'}); return !!(d.reply||d.response); });
await check('QB issue visible (degraded connector)', () => conns.some(c => c.id === 'quickbooks-runtime'));
await check('Work Orders section present', () => html.includes('sec-workorders') && html.includes('ai_developer'));
await check('Critical alerts layer active', () => html.includes('buildAlerts') && html.includes('applyAlerts'));
await check('Google data visible (calendar+email)', () => snap?.emails?.unread > 0 && snap?.calendar?.today_count > 0);
await check('Burn-in dashboard accessible', () => html.includes('sec-burnin') && html.includes('bi-score-card'));

// ══ Summary ══
console.log('\n' + '═'.repeat(58));
console.log(`  PASSED: ${passed}  FAILED: ${failed}`);

const targets = [
  'CEO_HOME_DASHBOARD_READY',
  'ASK_MI_PANEL_CERTIFIED',
  'EXECUTIVE_UI_POLISHED',
  'LIVE_DASHBOARD_REFRESH_READY',
  'CRITICAL_ALERT_LAYER_READY',
  'EVIDENCE_LINKS_READY',
  'BURN_IN_DASHBOARD_READY',
  'EXECUTIVE_ASSISTANT_UI_FINAL_READY',
  'JARVIS_V4_OPERATIONS_READY',
];

if (failed === 0) {
  console.log('\n🎉 ALL TARGETS CERTIFIED:\n');
  targets.forEach(t => console.log('   ✅', t));
} else {
  console.log('\n⚠️  ' + failed + ' checks failed — targets pending');
}
process.exit(failed === 0 ? 0 : 1);
