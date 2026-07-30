import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')

db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')
cur = db.cursor()

def store_name(path):
    p = path.lower()
    if 'rawstockton' in p: return 'Stockton'
    if 'jht ventures' in p: return 'The Rim'
    if 'bakudan ramen' in p: return 'Stone Oak'
    if 'bakudan bp' in p: return 'Bandera'
    if 'coppers' in p: return 'Copper'
    if 'new tea house' in p: return 'IFT'
    if 'jinya' in p: return 'Jinya'
    if 'laptop1-default' in p: return 'Laptop1-Placeholder'
    return path.split('\\')[-1].replace('.qbw','')

print('='*80)
print('  QB STRESS AUDIT  CFO VIEW  2026-07-09')
print('  DEV4 | Coder, Designer, CFO, Chef Accountant')
print('='*80)

cur.execute('SELECT company_file_id, company_file_path, machine_hostname, last_sync_at, sync_count FROM qb_company_files ORDER BY sync_count DESC')
companies = {}
for r in cur.fetchall():
    cfid, cfpath, mhost, last_sync, sync_cnt = r
    store = store_name(cfpath)
    companies[cfid] = {'store': store, 'cfid': cfid, 'cfpath': cfpath, 'machine': mhost, 'last_sync': last_sync, 'sync_count': sync_cnt}

print('\n### 1. COMPANY FILES (8 total in mirror)')
print(f'  #  Store                  Syncs  Last Sync             Machine                          PATH')
print('  ' + '-'*110)
for i, (cfid, c) in enumerate(companies.items(), 1):
    print(f'  {i:<3} {c["store"]:<22} {c["sync_count"]:<7} {c["last_sync"]:<20} {c["machine"]:<30}')
    print(f'      PATH: {c["cfpath"]}')

mapping_stores = ['The Rim','Stockton','Stone Oak','Bandera','Copper','IFT','Jinya']
synced_stores = [c['store'] for c in companies.values()]
missing = [s for s in mapping_stores if s not in synced_stores]
extra = [s for s in synced_stores if s not in mapping_stores]

print('\n### 2. MAPPING vs MIRROR GAP')
print(f'  Mapping defines : {mapping_stores}')
print(f'  Mirror has      : {synced_stores}')
print(f'  MISSING (in mapping, not synced): {missing}')
print(f'  EXTRA (in mirror, not in mapping): {extra}')

print('\n### 3. SYNC LOG BY ENTITY TYPE')
for cfid, c in companies.items():
    total = cur.execute('SELECT COUNT(*) FROM qb_sync_log WHERE company_file_id=?',(cfid,)).fetchone()[0]
    print(f'  [{c["store"]}] total_ops={total}')
    cur.execute('SELECT entity_type, COUNT(*), SUM(records_upserted), MAX(synced_at) FROM qb_sync_log WHERE company_file_id=? GROUP BY entity_type',(cfid,))
    for et, cnt, ups, last in cur.fetchall():
        print(f'    {et:<20} ops={cnt} upserted={ups} last={last}')
    cur.execute('SELECT synced_at, entity_type, records_upserted, machine_id FROM qb_sync_log WHERE company_file_id=? ORDER BY synced_at DESC LIMIT 1',(cfid,))
    last_rec = cur.fetchone()
    if last_rec:
        print(f'    LAST: {last_rec}')

print('\n### 4. DATA FRESHNESS (24h / 1h window)')
for cfid, c in companies.items():
    last24 = cur.execute("SELECT COUNT(*) FROM qb_sync_log WHERE company_file_id=? AND synced_at >= datetime('now','-24 hours')",(cfid,)).fetchone()[0]
    last1  = cur.execute("SELECT COUNT(*) FROM qb_sync_log WHERE company_file_id=? AND synced_at >= datetime('now','-1 hour')",(cfid,)).fetchone()[0]
    maxt   = cur.execute("SELECT MAX(synced_at) FROM qb_sync_log WHERE company_file_id=?",(cfid,)).fetchone()[0]
    flag = 'OK' if last24 > 0 else 'STALE'
    print(f'  [{flag}] {c["store"]:<22} last24h={last24:<4} last1h={last1:<3} max_ts={maxt}')

print('\n### 5. ENTITY COUNTS')
print(f'  {"Store":<22} {"Accts":<7} {"Cust":<7} {"Vend":<7} {"Inv":<7} {"SR":<7} {"Bills":<7} {"PMTs":<7}')
print('  ' + '-'*80)
for cfid, c in companies.items():
    accts = cur.execute('SELECT COUNT(*) FROM qb_accounts WHERE company_file_id=?',(cfid,)).fetchone()[0]
    cust  = cur.execute('SELECT COUNT(*) FROM qb_customers WHERE company_file_id=?',(cfid,)).fetchone()[0]
    vend  = cur.execute('SELECT COUNT(*) FROM qb_vendors WHERE company_file_id=?',(cfid,)).fetchone()[0]
    inv   = cur.execute('SELECT COUNT(*) FROM qb_invoices WHERE company_file_id=?',(cfid,)).fetchone()[0]
    sr    = cur.execute('SELECT COUNT(*) FROM qb_sales_receipts WHERE company_file_id=?',(cfid,)).fetchone()[0]
    bills = cur.execute('SELECT COUNT(*) FROM qb_bills WHERE company_file_id=?',(cfid,)).fetchone()[0]
    pmts  = cur.execute('SELECT COUNT(*) FROM qb_payments WHERE company_file_id=?',(cfid,)).fetchone()[0]
    print(f'  {c["store"]:<22} {accts:<7} {cust:<7} {vend:<7} {inv:<7} {sr:<7} {bills:<7} {pmts:<7}')

print('\n### 6. FINANCIAL TOTALS')
print(f'  {"Store":<22} {"Invoice $":>14} {"Inv30d":<8} {"SR $":>14} {"SR30d":<8} {"Bills $":>14} {"Bil30d":<8}')
print('  ' + '-'*90)
for cfid, c in companies.items():
    inv_t  = cur.execute('SELECT COALESCE(SUM(total_amount),0) FROM qb_invoices WHERE company_file_id=?',(cfid,)).fetchone()[0]
    inv30  = cur.execute("SELECT COUNT(*) FROM qb_invoices WHERE company_file_id=? AND txn_date >= date('now','-30 days')",(cfid,)).fetchone()[0]
    sr_t   = cur.execute('SELECT COALESCE(SUM(total_amount),0) FROM qb_sales_receipts WHERE company_file_id=?',(cfid,)).fetchone()[0]
    sr30   = cur.execute("SELECT COUNT(*) FROM qb_sales_receipts WHERE company_file_id=? AND txn_date >= date('now','-30 days')",(cfid,)).fetchone()[0]
    bil_t  = cur.execute('SELECT COALESCE(SUM(amount_due),0) FROM qb_bills WHERE company_file_id=?',(cfid,)).fetchone()[0]
    bil30  = cur.execute("SELECT COUNT(*) FROM qb_bills WHERE company_file_id=? AND txn_date >= date('now','-30 days')",(cfid,)).fetchone()[0]
    print(f'  {c["store"]:<22} ${inv_t:>13,.0f} {inv30:<8} ${sr_t:>13,.0f} {sr30:<8} ${bil_t:>13,.0f} {bil30:<8}')

print('\n### 7. GRAND TOTALS (All 8 stores)')
keys = list(companies.keys())
t_inv  = sum(cur.execute('SELECT COALESCE(SUM(total_amount),0) FROM qb_invoices WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_sr   = sum(cur.execute('SELECT COALESCE(SUM(total_amount),0) FROM qb_sales_receipts WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_bil  = sum(cur.execute('SELECT COALESCE(SUM(amount_due),0) FROM qb_bills WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_a    = sum(cur.execute('SELECT COUNT(*) FROM qb_accounts WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_c    = sum(cur.execute('SELECT COUNT(*) FROM qb_customers WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_v    = sum(cur.execute('SELECT COUNT(*) FROM qb_vendors WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_inv_c= sum(cur.execute('SELECT COUNT(*) FROM qb_invoices WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_sr_c = sum(cur.execute('SELECT COUNT(*) FROM qb_sales_receipts WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
t_bil_c= sum(cur.execute('SELECT COUNT(*) FROM qb_bills WHERE company_file_id=?',(k,)).fetchone()[0] for k in keys)
print(f'  Total Accounts:    {t_a:,}')
print(f'  Total Customers:   {t_c:,}')
print(f'  Total Vendors:     {t_v:,}')
print(f'  Total Invoices:    {t_inv_c:,}  =  ${t_inv:,.0f}')
print(f'  Total SalesRcpts:  {t_sr_c:,}  =  ${t_sr:,.0f}')
print(f'  Total Bills:       {t_bil_c:,}  =  ${t_bil:,.0f}')
print(f'  Net Revenue (SR-Invoice): ${t_sr-t_inv:,.0f}')
print('\n=== DONE ===')
