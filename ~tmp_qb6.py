import sqlite3  
db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')  
cur = db.cursor()  
print('=== SALES RECEIPT SUMMARY BY COMPANY ===')  
cur.execute('SELECT company_file_id, COUNT(*), SUM(txn_total) FROM qb_sales_receipts GROUP BY company_file_id')  
cols = [d[0] for d in cur.description]  
for r in cur.fetchall():  
    print(dict(zip(cols, r)))  
