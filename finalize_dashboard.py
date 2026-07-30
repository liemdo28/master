#!/usr/bin/env python3
c = open(r'd:/Project/Master/mi-core/ui/qb-dashboard.html', encoding='utf-8', errors='ignore').read()

if "function renderStores" in c:
    print("renderStores already exists")
else:
    # Add render functions before loadAll
    js = """
function renderStores() {
  fetch('/api/qb/mirror/stores').then(r=>r.json()).then(d=>{
    if(!d.ok||!d.stores||!d.stores.length){document.getElementById('ti-stores').innerHTML='<div class="no-data">No stores found</div>';return;}
    var t=d.totals||{};
    var rows=d.stores.map(function(s){return'<tr><td>'+(s.store||'—')+'</td><td>'+(s.company_name||'—')+'</td><td class="amount">'+fmtC(s.sales||0)+'</td><td class="amount">'+fmtC(s.ar||0)+'</td><td class="amount">'+fmtC(s.ap||0)+'</td><td class="amount">'+fmtC(s.cash||0)+'</td><td class="amount '+(s.net_income>=0?'green':'red')+'">'+fmtC(s.net_income||0)+'</td><td>'+fmtD(s.synced_at)+'</td></tr>';}).join('');
    document.getElementById('ti-stores').innerHTML='<div class="stat-row"><div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value green">'+fmtC(t.sales||0)+'</div></div><div class="stat"><div class="stat-label">A/R Outstanding</div><div class="stat-value amber">'+fmtC(t.ar||0)+'</div></div><div class="stat"><div class="stat-label">A/P Outstanding</div><div class="stat-value red">'+fmtC(t.ap||0)+'</div></div><div class="stat"><div class="stat-label">Cash</div><div class="stat-value green">'+fmtC(t.cash||0)+'</div></div><div class="stat"><div class="stat-label">Net Income</div><div class="stat-value green">'+fmtC(t.net_income||0)+'</div></div></div><div class="table-scroll"><table><thead><tr><th>Store</th><th>Company</th><th class="amount">Revenue</th><th class="amount">A/R</th><th class="amount">A/P</th><th class="amount">Cash</th><th class="amount">Net Income</th><th>Last Synced</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }).catch(function(){document.getElementById('ti-stores').innerHTML='<div class="no-data">Failed to load</div>';});
}
function renderStoreDetail() {
  var co=encodeURIComponent(document.getElementById('sel-company')&&document.getElementById('sel-company').value||'');
  fetch('/api/qb/mirror/store-report'+(co?'?company='+co:'')).then(r=>r.json()).then(function(d){
    if(!d.ok){document.getElementById('ti-store-detail').innerHTML='<div class="no-data">Failed</div>';return;}
    var pl=d.pl||{},bs=d.balance_sheet||{},ca=d.cash||{},ar=d.ar||{},ap=d.ap||{};
    var gm=pl.income?((pl.income-pl.cogs)/pl.income*100).toFixed(1)+'%':'—';
    document.getElementById('ti-store-detail').innerHTML='<div class="stat-row"><div class="stat"><div class="stat-label">Revenue</div><div class="stat-value green">'+fmtC(pl.income||0)+'</div></div><div class="stat"><div class="stat-label">COGS</div><div class="stat-value red">'+fmtC(pl.cogs||0)+'</div></div><div class="stat"><div class="stat-label">Gross Margin</div><div class="stat-value">'+gm+'</div></div><div class="stat"><div class="stat-label">Net Income</div><div class="stat-value '+(pl.net>=0?'green':'red')+'">'+fmtC(pl.net||0)+'</div></div><div class="stat"><div class="stat-label">A/R Outstanding</div><div class="stat-value amber">'+fmtC(ar.total||0)+'<div class="stat-sub">'+(ar.count||0)+' invoices</div></div><div class="stat"><div class="stat-label">A/P Outstanding</div><div class="stat-value red">'+fmtC(ap.total||0)+'<div class="stat-sub">'+(ap.count||0)+' bills</div></div><div class="stat"><div class="stat-label">Cash</div><div class="stat-value">'+fmtC((ca.deposits||0)+(ca.checks||0))+'</div></div><div class="stat"><div class="stat-label">Assets</div><div class="stat-value">'+fmtC(bs.assets||0)+'</div></div></div>';
  }).catch(function(){document.getElementById('ti-store-detail').innerHTML='<div class="no-data">Failed</div>';});
}
function renderStoreRevenue() {
  var co=encodeURIComponent(document.getElementById('sel-company')&&document.getElementById('sel-company').value||'');
  fetch('/api/qb/mirror/store-revenue'+(co?'?company='+co:'')).then(r=>r.json()).then(function(d){
    if(!d.ok||!d.months||!d.months.length){document.getElementById('ti-store-revenue').innerHTML='<div class="no-data">No revenue data</div>';return;}
    var rows=d.months.map(function(m){return'<tr><td>'+m.month+'</td><td class="amount">'+fmtC(m.receipts||0)+'</td><td class="amount">'+fmtC(m.paid_invoices||0)+'</td><td class="amount">'+fmtC(m.total||0)+'</td></tr>';}).join('');
    document.getElementById('ti-store-revenue').innerHTML='<div class="stat-row"><div class="stat"><div class="stat-label">Grand Total</div><div class="stat-value green">'+fmtC(d.grand_total||0)+'</div></div><div class="stat"><div class="stat-label">Periods</div><div class="stat-value">'+d.months.length+'</div></div></div><div class="table-scroll"><table><thead><tr><th>Month</th><th class="amount">Receipts</th><th class="amount">Paid Invoices</th><th class="amount">Total</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }).catch(function(){document.getElementById('ti-store-revenue').innerHTML='<div class="no-data">Failed</div>';});
}
function renderStoreCompare() {
  fetch('/api/qb/mirror/store-compare').then(r=>r.json()).then(function(d){
    if(!d.ok||!d.stores||!d.stores.length){document.getElementById('ti-store-compare').innerHTML='<div class="no-data">No stores found</div>';return;}
    var rows=d.stores.map(function(s){return'<tr><td>'+(s.store||'—')+'</td><td class="amount">'+fmtC(s.sales||0)+'</td><td class="amount">'+fmtC(s.ar||0)+'</td><td class="amount">'+fmtC(s.ap||0)+'</td><td class="amount">'+fmtC(s.cash||0)+'</td><td class="amount '+(s.net_income>=0?'green':'red')+'">'+fmtC(s.net_income||0)+'</td><td class="amount">'+fmtC(s.total_assets||0)+'</td><td class="amount">'+fmtC(s.total_liabilities||0)+'</td><td class="amount">'+fmtC(s.total_equity||0)+'</td></tr>';}).join('');
    document.getElementById('ti-store-compare').innerHTML='<div class="table-scroll"><table><thead><tr><th>Store</th><th class="amount">Revenue</th><th class="amount">A/R</th><th class="amount">A/P</th><th class="amount">Cash</th><th class="amount">Net Income</th><th class="amount">Assets</th><th class="amount">Liabilities</th><th class="amount">Equity</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }).catch(function(){document.getElementById('ti-store-compare').innerHTML='<div class="no-data">Failed</div>';});
}
"""

    # Find loadAll function and insert before it
    idx = c.find('function loadAll')
    if idx >= 0:
        c = c[:idx] + js + '\n' + c[idx:]
        print("Added render functions before loadAll")
    else:
        # Try to find loadAll() call
        idx = c.find('loadAll()')
        if idx >= 0:
            c = c[:idx] + js + '\n' + c[idx:]
            print("Added render functions before loadAll()")

    # Add switch cases - find nav function switch
    # Look for "default:" or the last "break;" in the nav switch
    # Find the nav function
    nav_idx = c.find('function nav(')
    if nav_idx < 0:
        print("ERROR: nav function not found")
    else:
        # Find switch statement within nav
        switch_idx = c.find('switch', nav_idx)
        if switch_idx < 0:
            print("ERROR: switch not found in nav")
        else:
            # Find closing brace of switch - look for the pattern with break; }
            # Insert our cases before the last closing
            # Simple approach: add cases right before the closing of the switch
            # Find the switch block
            switch_start = switch_idx
            brace_count = 0
            i = switch_start
            while i < len(c):
                if c[i] == '{': brace_count += 1
                elif c[i] == '}': 
                    brace_count -= 1
                    if brace_count == 0:
                        switch_end = i + 1
                        break
                i += 1
            
            switch_block = c[switch_start:switch_end]
            
            # Check if 'stores' already exists
            if "'stores'" not in switch_block:
                new_cases = "case 'stores': renderStores(); break;\ncase 'store-detail': renderStoreDetail(); break;\ncase 'store-revenue': renderStoreRevenue(); break;\ncase 'store-compare': renderStoreCompare(); break;\n"
                # Insert before the closing brace
                c = c[:switch_end-1] + new_cases + c[switch_end-1:]
                print("Added switch cases")
            else:
                print("Switch cases already exist")

open(r'd:/Project/Master/mi-core/ui/qb-dashboard.html', 'w', encoding='utf-8').write(c)
print("Done, size:", len(c))
