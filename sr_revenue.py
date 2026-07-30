import sqlite3, json, sys, base64
sys.stdout.reconfigure(encoding='utf-8')
db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')
cur = db.cursor()

def get_path(b64):
    try:
        return base64.b64decode(b64).decode('utf-16-le', errors='replace').lower()
    except:
        return b64.lower()

def sn(cfid):
    p = get_path(cfid)
    if 'rawstockton' in p: return 'Stockton'
    if 'jht ventures' in p: return 'The Rim'
    if 'bakudan ramen' in p: return 'Stone Oak'
    if 'bakudan bp' in p: return 'Bandera'
    if 'coppers' in p: return 'Copper'
    if 'new tea house' in p: return 'IFT'
    if 'jinya' in p: return 'Jinya'
    return 'Unknown(' + cfid[:20] + ')'

print('=== SR_TOTALS ===')
cur.execute('SELECT company_file_id, COUNT(*), SUM(total_amount) FROM qb_sales_receipts GROUP BY company_file_id')
for r in cur.fetchall():
    print(sn(r[0]), r[1], r[2])

print('=== LINE_ITEMS_SAMPLE ===')
cur.execute("SELECT company_file_id, txn_id, txn_date, total_amount, line_items_json FROM qb_sales_receipts WHERE total_amount != 0 LIMIT 3")
for r in cur.fetchall():
    nm = sn(r[0])
    items = json.loads(r[4]) if r[4] else []
    pos = [(i.get('item_name'), i.get('amount')) for i in items if i.get('amount', 0) > 0]
    neg = [(i.get('item_name'), i.get('amount')) for i in items if i.get('amount', 0) < 0]
    print(nm, r[1], r[2], r[3], pos, neg)

print('=== LINE_ITEMS_REVENUE_BY_STORE ===')
bc = {}
cur.execute('SELECT company_file_id, line_items_json FROM qb_sales_receipts')
for cfid, ij in cur.fetchall():
    nm = sn(cfid)
    items = json.loads(ij) if ij else []
    pos_a = sum(i.get('amount', 0) for i in items if i.get('amount', 0) > 0)
    neg_a = sum(i.get('amount', 0) for i in items if i.get('amount', 0) < 0)
    net = pos_a + neg_a
    if nm not in bc:
        bc[nm] = [0, 0, 0]
    bc[nm][0] += pos_a
    bc[nm][1] += neg_a
    bc[nm][2] += net
for nm, vals in sorted(bc.items()):
    print(nm, round(vals[0],2), round(vals[1],2), round(vals[2],2))
