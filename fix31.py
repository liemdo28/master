import os, re

BASE = 'D:/Project/Master/agent-engine'

PHASES = [
    (31,'phase-31-supply-chain-os','SupplyChainOS'),
    (32,'phase-32-legal-compliance-os','LegalComplianceOS'),
    (33,'phase-33-product-innovation-os','ProductInnovationOS'),
    (34,'phase-34-fleet-transport-os','FleetTransportOS'),
    (35,'phase-35-fraud-risk-os','FraudRiskOS'),
    (36,'phase-36-customer-loyalty-os','CustomerLoyaltyOS'),
    (37,'phase-37-partner-channel-os','PartnerChannelOS'),
    (38,'phase-38-finance-accounting-os','FinanceAccountingOS'),
    (39,'phase-39-data-warehouse-os','DataWarehouseOS'),
    (40,'phase-40-autonomous-ops-os','AutonomousOpsOS'),
]

for NUM, FOLDER, CLS in PHASES:
    p = f'{BASE}/{FOLDER}/src/orchestrator.js'
    with open(p, encoding='utf-8') as f:
        c = f.read()

    # Fix approve: re-find after update
    old_approve = "approve(id){{const r=this.signals.find(x=>x.id===id);if(r)this.signals.update(r.id,{{status:'approved',approvedAt:Date.now()}});return r;}}"
    new_approve = "approve(id){{const r=this.signals.find(x=>x.id===id);if(r){{this.signals.update(r.id,{{status:'approved',approvedAt:Date.now()}});return this.signals.find(x=>x.id===id);}}return r;}}"
    c = c.replace(old_approve, new_approve)

    # Fix reject: re-find after update
    old_reject = "reject(id){{const r=this.signals.find(x=>x.id===id);if(r)this.signals.update(r.id,{{status:'rejected',rejectedAt:Date.now()}});return r;}}"
    new_reject = "reject(id){{const r=this.signals.find(x=>x.id===id);if(r){{this.signals.update(r.id,{{status:'rejected',rejectedAt:Date.now()}});return this.signals.find(x=>x.id===id);}}return r;}}"
    c = c.replace(old_reject, new_reject)

    # Fix escalate: re-find after update
    old_esc = "escalate(id,reason){{const r=this.signals.find(x=>x.id===id);if(r)this.signals.update(r.id,{{status:'escalated',escalatedAt:Date.now(),reason}});return r;}}"
    new_esc = "escalate(id,reason){{const r=this.signals.find(x=>x.id===id);if(r){{this.signals.update(r.id,{{status:'escalated',escalatedAt:Date.now(),reason}});return this.signals.find(x=>x.id===id);}}return r;}}"
    c = c.replace(old_esc, new_esc)

    # Fix acknowledgeAlert: re-find after update
    old_ack = "acknowledgeAlert(id){{const a=this.alerts.find(x=>x.id===id);if(a)this.alerts.update(a.id,{{acknowledged:true,acknowledgedAt:Date.now()}});return a;}}"
    new_ack = "acknowledgeAlert(id){{const a=this.alerts.find(x=>x.id===id);if(a){{this.alerts.update(a.id,{{acknowledged:true,acknowledgedAt:Date.now()}});return this.alerts.find(x=>x.id===id);}}return a;}}"
    c = c.replace(old_ack, new_ack)

    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'Phase {NUM} ({FOLDER}) patched')
