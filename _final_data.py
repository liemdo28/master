import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8')
db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')
cur = db.cursor()

def sn(cfpath):
    p = cfpath.lower()
    if 'rawstockton' in p: return 'Stockton'
    if 'jht ventures' in p: return 'The Rim'
    if 'bakudan ramen' in p: return 'Stone Oak'
    if 'bakudan bp' in p: return 'Bandera'
    if 'coppers' in p: return 'Copper'
    if 'new tea house' in p: return 'IFT'
    if 'jinya' in p: return 'Jinya'
    if 'laptop1-default' in p: return 'Laptop1-Placeholder'
    return cfpath

# Get cfid -> path mapping
cfid_to_path = {}
cur.execute('SELECT company_file_id, company_file_path FROM qb_company_files')
for cfid, cfpath in cur.fetchall():
    cfid_to_path[cfid] = cfpath

# LINE ITEM REVENUE
bc = {}
cur.execute('SELECT company_file_id, line_items_json FROM qb_sales_receipts')
for cfid, ij in cur.fetchall():
    nm = sn(cfid_to_path.get(cfid, ''))
    items = json.loads(ij) if ij else []
    pos_a = sum(i.get('