f=open('D:/Project/Master/mi-core/server/src/oss-runtime/oss-worker-registry.ts','r',encoding='utf-8')
c=f.read();f.close()
old="  { id: 'grafana', name: 'Grafana', phase: 30, businessRole: 'executive command-center dashboards', ownerDivision: 'executive', license: 'AGPL-3.0', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 3030 }, fallback: 'in-engine CEO command-center renderer' },\n];"
new="""  { id: 'grafana', name: 'Grafana', phase: 30, businessRole: 'executive command-center dashboards', ownerDivision: 'executive', license: 'AGPL-3.0', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 3030 }, fallback: 'in-engine CEO command-center renderer' },

  // Phase 31-40 primary workers — same runtime contract.
  { id: 'supplier-hub', name: 'ODOO Community (Supply Chain)', phase: 31, businessRole: 'supply chain + vendor delivery + logistics', ownerDivision: 'operations', license: 'GPL-3.0', licenseRisk: 'medium', probe: { kind: 'module', module: 'odoorpc' }, fallback: 'in-engine supply-chain + vendor delivery signals' },
  { id: 'legal-hub', name: 'PostgreSQL Legal Hub', phase: 32, businessRole: 'legal + contract + compliance + regulatory', ownerDivision: 'legal', license: 'PostgreSQL', licenseRisk: 'low', probe: { kind: 'module', module: 'pg' }, fallback: 'in-engine legal-compliance + contract registry' },
  { id: 'innovate-db', name: 'PostgreSQL Innovation Pipeline', phase: 33, businessRole: 'menu R&D + product pipeline + supplier innovation', ownerDivision: 'product', license: 'PostgreSQL', licenseRisk: 'low', probe: { kind: 'module', module: 'pg' }, fallback: 'in-engine product-innovation + R&D pipeline' },
  { id: 'fleet-mgmt', name: 'ODOO Community (Fleet)', phase: 34, businessRole: 'delivery fleet + vehicle ops + driver management', ownerDivision: 'operations', license: 'GPL-3.0', licenseRisk: 'medium', probe: { kind: 'module', module: 'odoorpc' }, fallback: 'in-engine fleet-transport + driver signals' },
  { id: 'fraudscore-oss', name: 'FraudScore OSS', phase: 35, businessRole: 'payment fraud + refund abuse + chargeback detection', ownerDivision: 'fraud-risk', license: 'MIT', licenseRisk: 'low', probe: { kind: 'env', env: 'FRAUDSCORE_URL' }, fallback: 'in-engine fraud-risk + refund abuse signals' },
  { id: 'rewards-engine', name: 'PostgreSQL Loyalty Engine', phase: 36, businessRole: 'rewards + retention + VIP lifecycle management', ownerDivision: 'customer-loyalty', license: 'PostgreSQL', licenseRisk: 'low', probe: { kind: 'module', module: 'pg' }, fallback: 'in-engine customer-loyalty + VIP lifecycle signals' },
  { id: 'doordash-api', name: 'DoorDash API', phase: 37, businessRole: 'DoorDash + aggregator + partner onboarding', ownerDivision: 'partner-channel', license: 'Proprietary', licenseRisk: 'medium', probe: { kind: 'env', env: 'DOORDASH_API_URL' }, fallback: 'in-engine partner-channel + DoorDash aggregator signals' },
  { id: 'sql-ledger', name: 'SQL-Ledger', phase: 38, businessRole: 'GL + AP/AR + reconciliation + tax', ownerDivision: 'finance-accounting', license: 'GPL-2.0', licenseRisk: 'low', probe: { kind: 'module', module: 'better-sqlite3' }, fallback: 'in-engine finance-accounting + GL signals' },
  { id: 'airbyte', name: 'Airbyte', phase: 39, businessRole: 'ETL pipeline + data warehouse + BI reporting', ownerDivision: 'data-warehouse', license: 'MIT', licenseRisk: 'low', probe: { kind: 'module', module: 'airbyte-sdk' }, fallback: 'in-engine data-warehouse + ETL signals' },
  { id: 'autonomy-core', name: 'Temporal / n8n Autonomy Core', phase: 40, businessRole: 'self-healing + autonomous orchestration + rollback', ownerDivision: 'autonomous-ops', license: 'MIT', licenseRisk: 'low', probe: { kind: 'module', module: '@temporalio/client' }, fallback: 'in-engine autonomous-ops + self-healing signals' },
];"""
if old in c:
    c2=c.replace(old,new,1)
    f2=open('D:/Project/Master/mi-core/server/src/oss-runtime/oss-worker-registry.ts','w',encoding='utf-8')
    f2.write(c2);f2.close()
    print('Registry updated OK, new length:',len(c2))
else:
    print('ERROR: old string not found in registry')
    idx=c.find('grafana')
    print('grafana context:',repr(c[max(0,idx-20):idx+100]))
