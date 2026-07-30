import sqlite3  
db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')  
cur = db.cursor()  
print('=== BILLS AND BILL PAYMENTS BY COMPANY ===')  
cur.execute('SELECT company_file_id, COUNT(*) as cnt, SUM(txn_total) as total_amt FROM qb_bills GROUP BY company_file_id')  
print('BILLS:')  
cols = [d[0] for d in cur.description]  
for r in cur.fetchall():  
    print(dict(zip(cols, r)))  
cur.execute('SELECT company_file_id, COUNT(*) as cnt, SUM(txn_total) as total_amt FROM qb_bill_payments GROUP BY company_file_id')  
print('BILL PAYMENTS:')  
cols = [d[0] for d in cur.description]  
for r in cur.fetchall():  
    print(dict(zip(cols, r)))  
