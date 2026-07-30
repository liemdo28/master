import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')
db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')
cur = db.cursor()

# Check schemas
for tbl in ['qb_invoices','qb_sales_receipts','qb_sync_log','qb_bills','qb_customers','qb_vendors','qb_accounts']:
    cur.execute(f'PRAGMA table_info({tbl})')
    cols = [(s[1], s[2]) for s in cur.fetchall()]
    print(f'{tbl}: {cols}')

# Sample rows
for tbl in ['qb_invoices','qb_sales_receipts','qb_sync_log','qb_bills']:
    cur.execute(f'SELECT * FROM {tbl} LIMIT 1')
    r = cur.fetchone()
    print(f'{tbl} sample: {r}')
