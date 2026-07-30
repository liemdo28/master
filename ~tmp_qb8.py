import sqlite3  
db = sqlite3.connect('d:/Project/Master/.local-agent-global/quickbooks/qb-mirror.db')  
cur = db.cursor()  
print('=== CHECKS AND DEPOSITS BY COMPANY ===')  
cur.execute('SELECT company_file_id, COUNT(*) as cnt, SUM(txn_total) as total_amt FROM qb_checks GROUP BY company_file_id')  
print('CHECKS:')  
cols = [d[0] for d in cur.description]  
for r in cur.fetchall():  
    print(dict(zip(cols, r)))  
cur.execute('SELECT company_file_id, COUNT(*) as cnt, SUM(txn_total) as total_amt FROM qb_deposits GROUP BY company_file_id')  
print('DEPOSITS:')  
cols = [d[0] for d in cur.description]  
for r in cur.fetchall():  
    print(dict(zip(cols, r)))  
