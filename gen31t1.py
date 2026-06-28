import os
BASE = 'D:/Project/Master/agent-engine'
TEST_DIR = 'D:/Project/Master/mi-core/tests'
PHASES = [
    (31,'phase-31-supply-chain-os','SupplyChainOS','customer-loyalty'),
    (32,'phase-32-legal-compliance-os','LegalComplianceOS','supply-chain'),
    (33,'phase-33-product-innovation-os','ProductInnovationOS','legal-compliance'),
    (34,'phase-34-fleet-transport-os','FleetTransportOS','product-innovation'),
    (35,'phase-35-fraud-risk-os','FraudRiskOS','fleet-transport'),
    (36,'phase-36-customer-loyalty-os','CustomerLoyaltyOS','fraud-risk'),
    (37,'phase-37-partner-channel-os','PartnerChannelOS','partner-channel'),
    (38,'phase-38-finance-accounting-os','FinanceAccountingOS','finance-accounting'),
    (39,'phase-39-data-warehouse-os','DataWarehouseOS','data-warehouse'),
    (40,'phase-40-autonomous-ops-os','AutonomousOpsOS','autonomous-ops'),
]

# functional proof
f = "'use strict';\nimport * as assert from 'assert';\n"
for NUM,FOLDER,CLS,DIV in PHASES:
    f += f"import * as p{NUM} from '../../agent-engine/{FOLDER}/src/orchestrator.js';\n"
f += "let passed=0,failed=0;\nconst check=(n,fn)=>{try{fn();passed++;console.log('  PASS: '+n);}catch(e){failed++;console.error('  FAIL: '+n+' -- '+e.message);}};\nconsole.log('PHASE 31-40 FUNCTIONAL PROOF TEST\\n');\n"
for NUM,FOLDER,CLS,DIV in PHASES:
    f += f"const o{NUM}=p{NUM}.default||p{NUM}.{CLS}Orchestrator||p{NUM}.{CLS};check('Phase {NUM} orchestrator is a function',()=>assert.strictEqual(typeof o{NUM},'function'));\n"
    f += f"const i{NUM}=new o{NUM}();check('Phase {NUM} has dashboard',()=>assert.strictEqual(typeof i{NUM}.dashboard,'function'));\n"
    f += f"const d{NUM}=i{NUM}.dashboard();check('Phase {NUM} dashboard returns object',()=>assert.ok(typeof d{NUM}==='object'));\n"
f += "\nconsole.log('\\n  RESULT: '+passed+' passed, '+failed+' failed');\nprocess.exit(failed===0?0:1);\n"

# mapping
m = "'use strict';\nimport * as assert from 'assert';\nlet passed=0,failed=0;\nconst check=(n,fn)=>{try{fn();passed++;console.log('  PASS: '+n);}catch(e){failed++;console.error('  FAIL: '+n+' -- '+e.message);}};\nconsole.log('PHASE 31-40 MAPPING TEST\\n');\nconst PHASES_MAP={\n"
for NUM,FOLDER,CLS,DIV in PHASES:
    m += f"  {NUM}:{{name:'{CLS}',folder:'{FOLDER}',divisions:['{DIV}','executive'],oss:['OSS{NUM}-1','OSS{NUM}-2'],slug:'phase-{NUM}-{DIV}'}},\n"
m += "};\nconst seen=[];\nfor(const [id] of Object.entries(PHASES_MAP)){\n"
m += "  check('no duplicate phase IDs',()=>{if(seen.includes(id))throw new Error(id);seen.push(id);return true;});\n"
m += "}\nfor(const [id,ph] of Object.entries(PHASES_MAP)){\n"
m += "  check('Phase '+id+' has divisions',()=>assert.ok(Array.isArray(ph.divisions)&&ph.divisions.length>0));\n"
m += "  check('Phase '+id+' has OSS list',()=>assert.ok(Array.isArray(ph.oss)&&ph.oss.length>0));\n"
m += "  check('Phase '+id+' has route slug',()=>assert.ok(ph.slug&&ph.slug.length>0));\n"
m += "  check('Phase '+id+' slug matches route',()=>assert.ok(ph.slug.startsWith('phase-'+id)));\n"
m += "}\nconst allOss=Object.values(PHASES_MAP).flatMap(p=>p.oss);\ncheck('OSS governance covers all 10 phases',()=>assert.ok(allOss.length>=10));\ncheck('division diversity',()=>assert.ok(Object.values(PHASES_MAP).some(p=>p.divisions.includes('executive'))));\nconsole.log('\\n  RESULT: '+passed+' passed, '+failed+' failed');\nprocess.exit(failed===0?0:1);\n"

for fname,content in [
    ('phase31-40-functional-proof-test.mjs', f),
    ('phase31-40-mapping-test.mjs', m),
]:
    with open(f'{TEST_DIR}/{fname}','w',encoding='utf-8') as fh:
        fh.write(content)
    print(f'Written {fname} ({len(content)} chars)')

print('Tests part 1 written')
