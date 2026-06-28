f=open('D:/Project/Master/mi-core/server/src/routes/agent-os.ts','r',encoding='utf-8')
lines=f.readlines();f.close()

new_phases=[
'  { id: 31, slug: \'31\', name: \'Supply Chain OS\', dir: \'phase-31-supply-chain-os\', summary: \'dashboard\' },\n',
'  { id: 32, slug: \'32\', name: \'Legal Compliance OS\', dir: \'phase-32-legal-compliance-os\', summary: \'dashboard\' },\n',
'  { id: 33, slug: \'33\', name: \'Product Innovation OS\', dir: \'phase-33-product-innovation-os\', summary: \'dashboard\' },\n',
'  { id: 34, slug: \'34\', name: \'Fleet Transport OS\', dir: \'phase-34-fleet-transport-os\', summary: \'dashboard\' },\n',
'  { id: 35, slug: \'35\', name: \'Fraud Risk OS\', dir: \'phase-35-fraud-risk-os\', summary: \'dashboard\' },\n',
'  { id: 36, slug: \'36\', name: \'Customer Loyalty OS\', dir: \'phase-36-customer-loyalty-os\', summary: \'dashboard\' },\n',
'  { id: 37, slug: \'37\', name: \'Partner Channel OS\', dir: \'phase-37-partner-channel-os\', summary: \'dashboard\' },\n',
'  { id: 38, slug: \'38\', name: \'Finance Accounting OS\', dir: \'phase-38-finance-accounting-os\', summary: \'dashboard\' },\n',
'  { id: 39, slug: \'39\', name: \'Data Warehouse OS\', dir: \'phase-39-data-warehouse-os\', summary: \'dashboard\' },\n',
'  { id: 40, slug: \'40\', name: \'Autonomous Ops OS\', dir: \'phase-40-autonomous-ops-os\', summary: \'dashboard\' },\n',
]
# Find the line containing phase-53
insert_idx=None
for i,line in enumerate(lines):
    if "'53'" in line and 'phase-53' in line:
        insert_idx=i; break
if insert_idx is None:
    print('ERROR: cannot find phase-53 line')
else:
    for j,p in enumerate(new_phases):
        lines.insert(insert_idx+j,p)
    f2=open('D:/Project/Master/mi-core/server/src/routes/agent-os.ts','w',encoding='utf-8')
    f2.writelines(lines);f2.close()
    print('Routes updated, total lines:',len(lines))