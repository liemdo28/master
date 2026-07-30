import sqlite3, json, sys, base64
sys.stdout.reconfigure(encoding='utf-8')

db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')
cur = db.cursor()

def store_name(p):
    p = p.lower()
    if 'rawstockton' in p: return 'Stockton'
    if 'jht ventures' in p: return 'The Rim'
    if 'bakudan ramen' in p: return 'Stone Oak'
    if 'bakudan bp' in p: return 'Bandera'
    if 'coppers' in p: return 'Copper'
    if 'new tea house' in p: return 'IFT'
    if 'jinya' in p: return 'Jinya'
    if 'laptop1-default' in p: return 'Laptop1-Placeholder'
    return p.split('\\')[-1]

print('=== SR total_amount BY COMPANY ===')
cur.execute('SELECT company_file_id, COUNT(*), SUM(total_amount) FROM qb_sales_receipts GROUP BY company_file_id')
for cfid, cnt, tot in cur.fetchall():
    name = store_name(cfid)
    print(f'  [{name}] {cnt} records, total_amount_sum=${tot}')

print('\n=== LINE ITEMS JSON ANALYSIS (non-Stockton) ===')
cur.execute("SELECT company_file_id, txn_id, txn_date, total_amount, line_items_json FROM qb_sales_receipts WHERE total_amount != 0 LIMIT 5")
for r in cur.fetchall():
    name = store_name(r[0])
    items = json.loads(r[4]) if r[4] else []
    pos = [(i.get('item_name'), i.get('amount')) for i in items if i.get('amount', 0) > 0]
    neg = [(i.get('item_name'), i.get('amount')) for i in items if i.get('amount', 0) < 0]
    print(f'  [{name}] txn={r[1]} date={r[2]} total_amount_field={r[3]}')
    print(f'    POS: {pos}')
    print(f'    NEG: {neg}')

print('\n=== ACTUAL REVENUE FROM LINE ITEMS ===')
cur.execute('SELECT company_file_id, txn_id, line_items_json FROM qb_sales_receipts')
grand_pos = grand_neg = grand_net = 0
by_company = {}
for cfid, txn_id, items_json in cur.fetchall():
    name = store_name(cfid)
    items = json.loads(items_json) if items_json else []
    pos_amt = sum(i.get('amount', 0) for i in items if i.get('amount', 0) > 0)
    neg_amt = sum(i.get('amount', 0) for i in items if i.get('amount', 0) < 0)
    net = pos_amt + neg_amt
    grand_pos += pos_amt
    grand_neg += neg_amt
    grand_net += net
    if name not in by_company:
        by_company[name] = {'pos': 0, 'neg': 0, 'net': 0}
    by_company[name]['pos'] += pos_amt
    by_company[name]['neg'] += neg_amt
    by_company[name]['net'] += net

for name, d in by_company.items():
    print(f'  [{name}] pos=${d["pos"]:,.0f} neg=${d["neg"]:,.0f} net