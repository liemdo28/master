import os

BASE = 'D:/Project/Master/agent-engine'

PHASES = [
    (31,'phase-31-supply-chain-os','SupplyChainOS','Supply chain + vendor delivery + logistics'),
    (32,'phase-32-legal-compliance-os','LegalComplianceOS','Legal + contract + compliance + regulatory'),
    (33,'phase-33-product-innovation-os','ProductInnovationOS','Menu R&D + product pipeline + supplier innovation'),
    (34,'phase-34-fleet-transport-os','FleetTransportOS','Delivery fleet + vehicle ops + driver mgmt'),
    (35,'phase-35-fraud-risk-os','FraudRiskOS','Payment fraud + refund abuse + chargeback'),
    (36,'phase-36-customer-loyalty-os','CustomerLoyaltyOS','Rewards + retention + VIP lifecycle'),
    (37,'phase-37-partner-channel-os','PartnerChannelOS','DoorDash + aggregator + partner onboarding'),
    (38,'phase-38-finance-accounting-os','FinanceAccountingOS','GL + AP/AR + reconciliation + tax'),
    (39,'phase-39-data-warehouse-os','DataWarehouseOS','ETL pipeline + warehouse + BI + forecasting'),
    (40,'phase-40-autonomous-ops-os','AutonomousOpsOS','Self-healing + autonomous orchestration + rollback'),
]

for NUM, FOLDER, CLS, DESC in PHASES:
    p = f'{BASE}/{FOLDER}/src/orchestrator.js'
    # The key fix: approve/reject/escalate/acknowledgeAlert must re-find after update
    content = (
        "// " + FOLDER + " - Phase " + str(NUM) + ". Modules: " + DESC + "\n"
        "// OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts\n"
        "import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';\n"
        "\n"
        "export class " + CLS + " {\n"
        "  constructor(opts={}) {\n"
        "    this.registry=new JsonStore('ph" + str(NUM) + "-reg',opts);\n"
        "    this.signals=new JsonStore('ph" + str(NUM) + "-sig',opts);\n"
        "    this.alerts=new JsonStore('ph" + str(NUM) + "-alr',opts);\n"
        "  }\n"
        "  register(s){\n"
        "    const r={id:makeId('S" + str(NUM) + "'),timestamp:Date.now(),signal:s.signal||s,status:'open',\n"
        "      approvalRequired:!!(s.requiresApproval),assignedTo:s.assignedTo||null};\n"
        "    this.signals.insert(r);return r;\n"
        "  }\n"
        "  approve(id){\n"
        "    const r=this.signals.find(x=>x.id===id);\n"
        "    if(r){this.signals.update(r.id,{status:'approved',approvedAt:Date.now()});return this.signals.find(x=>x.id===id);}\n"
        "    return r;\n"
        "  }\n"
        "  reject(id){\n"
        "    const r=this.signals.find(x=>x.id===id);\n"
        "    if(r){this.signals.update(r.id,{status:'rejected',rejectedAt:Date.now()});return this.signals.find(x=>x.id===id);}\n"
        "    return r;\n"
        "  }\n"
        "  escalate(id,reason){\n"
        "    const r=this.signals.find(x=>x.id===id);\n"
        "    if(r){this.signals.update(r.id,{status:'escalated',escalatedAt:Date.now(),reason});return this.signals.find(x=>x.id===id);}\n"
        "    return r;\n"
        "  }\n"
        "  pending(){return this.signals.filter(x=>x.status==='open');}\n"
        "  escalated(){return this.signals.filter(x=>x.status==='escalated');}\n"
        "  alert(level,msg,ref){\n"
        "    return this.alerts.insert({id:makeId('ALR'),timestamp:Date.now(),level,message:msg,ref:ref||null,acknowledged:false});\n"
        "  }\n"
        "  acknowledgeAlert(id){\n"
        "    const a=this.alerts.find(x=>x.id===id);\n"
        "    if(a){this.alerts.update(a.id,{acknowledged:true,acknowledgedAt:Date.now()});return this.alerts.find(x=>x.id===id);}\n"
        "    return a;\n"
        "  }\n"
        "  dashboard(){\n"
        "    const s=this.signals.all();const a=this.alerts.all();\n"
        "    const open=s.filter(x=>x.status==='open').length;\n"
        "    const esc=s.filter(x=>x.status==='escalated').length;\n"
        "    const crit=a.filter(x=>x.level==='critical'&&!x.acknowledged).length;\n"
        "    return{phase:" + str(NUM) + ",cls:'" + CLS + "',total:s.length,open,escalated:esc,criticalAlerts:crit,\n"
        "      status:crit>0?'CRITICAL':esc>3?'BUSY':open>5?'ACTIVE':'NORMAL'};\n"
        "  }\n"
        "}\n"
        "\n"
        "export class " + CLS + "Orchestrator{constructor(opts={}){this.os=new " + CLS + "(opts);}dashboard(){return this.os.dashboard();}}\n"
        "export default " + CLS + "Orchestrator;\n"
    )
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Phase {NUM} ({FOLDER}) fixed')

print('All 10 orchestrators rewritten correctly')
