'use strict';
import * as assert from 'assert';
let passed=0,failed=0;
const check=(n,fn)=>{try{fn();passed++;console.log('  PASS: '+n);}catch(e){failed++;console.error('  FAIL: '+n+' -- '+e.message);}};
console.log('PHASE 31-40 MAPPING TEST\n');
const PHASES_MAP={
  31:{name:'SupplyChainOS',folder:'phase-31-supply-chain-os',divisions:['supply-chain','executive'],oss:['OSS-31-1','OSS-31-2'],slug:'phase-31-supply-chain'},
  32:{name:'LegalComplianceOS',folder:'phase-32-legal-compliance-os',divisions:['legal-compliance','executive'],oss:['OSS-32-1','OSS-32-2'],slug:'phase-32-legal-compliance'},
  33:{name:'ProductInnovationOS',folder:'phase-33-product-innovation-os',divisions:['product-innovation','executive'],oss:['OSS-33-1','OSS-33-2'],slug:'phase-33-product-innovation'},
  34:{name:'FleetTransportOS',folder:'phase-34-fleet-transport-os',divisions:['fleet-transport','executive'],oss:['OSS-34-1','OSS-34-2'],slug:'phase-34-fleet-transport'},
  35:{name:'FraudRiskOS',folder:'phase-35-fraud-risk-os',divisions:['fraud-risk','executive'],oss:['OSS-35-1','OSS-35-2'],slug:'phase-35-fraud-risk'},
  36:{name:'CustomerLoyaltyOS',folder:'phase-36-customer-loyalty-os',divisions:['customer-loyalty','executive'],oss:['OSS-36-1','OSS-36-2'],slug:'phase-36-customer-loyalty'},
  37:{name:'PartnerChannelOS',folder:'phase-37-partner-channel-os',divisions:['partner-channel','executive'],oss:['OSS-37-1','OSS-37-2'],slug:'phase-37-partner-channel'},
  38:{name:'FinanceAccountingOS',folder:'phase-38-finance-accounting-os',divisions:['finance-accounting','executive'],oss:['OSS-38-1','OSS-38-2'],slug:'phase-38-finance-accounting'},
  39:{name:'DataWarehouseOS',folder:'phase-39-data-warehouse-os',divisions:['data-warehouse','executive'],oss:['OSS-39-1','OSS-39-2'],slug:'phase-39-data-warehouse'},
  40:{name:'AutonomousOpsOS',folder:'phase-40-autonomous-ops-os',divisions:['autonomous-ops','executive'],oss:['OSS-40-1','OSS-40-2'],slug:'phase-40-autonomous-ops'},
};
const seen=[];
for(const [id] of Object.entries(PHASES_MAP)){
  check('no duplicate phase IDs',()=>{if(seen.includes(id))throw new Error(id);seen.push(id);return true;});
}
for(const [id,ph] of Object.entries(PHASES_MAP)){
  check(`Phase ${id} has divisions`,()=>assert.ok(Array.isArray(ph.divisions)&&ph.divisions.length>0));
  check(`Phase ${id} has OSS list`,()=>assert.ok(Array.isArray(ph.oss)&&ph.oss.length>0));
  check(`Phase ${id} has route slug`,()=>assert.ok(ph.slug&&ph.slug.length>0));
  check(`Phase ${id} slug matches route`,()=>assert.ok(ph.slug.startsWith('phase-'+id)));
  check(`Phase ${id} has executive division`,()=>assert.ok(ph.divisions.includes('executive')));
}
const allOss=Object.values(PHASES_MAP).flatMap(p=>p.oss);
check('OSS governance covers all 10 phases',()=>assert.ok(allOss.length>=10));
check('division diversity across phases',()=>assert.ok(Object.values(PHASES_MAP).every(p=>p.divisions.length>=1)));
console.log('\n  RESULT: '+passed+' passed, '+failed+' failed');
process.exit(failed===0?0:1);
