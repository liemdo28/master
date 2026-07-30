import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')
db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')
cur = db.cursor()

print('COMPANY_FILES:')
cur.execute('SELECT company_file_id, company_file_path FROM qb_company_files')
for cfid, cfpath in cur.fetchall():
    print(' ', cfid, '->', cfpath)

print()
print('SR company_file_ids:')
cur.execute('SELECT DISTINCT company_file_id FROM qb_sales_receipts')
for r in cur.fetchall():
    print(' ', r[0])

print()
print('JOIN TEST:')
cur.execute('''
SELECT cf.company_file_path, COUNT(sr.txn_id)
FROM qb_company_files cf
LEFT JOIN qb_sales_receipts sr ON sr.company_file_id = cf.company_file_id
GROUP BY cf.company_file_id
''')
for r in cur.fetchall():
    print(' ', r)

print()
print('SR RAW:')
cur.execute('SELECT company_file_id, COUNT(*), SUM(total_amount) FROM qb_sales_receipts GROUP BY company_file_id')
for r in cur.fetchall():
    print(' ', r)
