'use strict';
import * as assert from 'assert';
let passed=0,failed=0;
const check=(n,f)=>{try{f();passed++;console.log('  PASS: '+n);}catch(e){failed++;console.error('  FAIL: '+n+' -- '+e.message);}};
console.log('PHASE 41-50 MAPPING TEST\n');
const PHASES_MAP={
  41:{name:'AICustomerSupportOS',dir:'phase-41-ai-customer-support',route:'/api/company-os/41',oss:'oss-phase-41'},
  42:{name:'TaxComplianceOS',dir:'phase-42-tax-compliance',route:'/api/company-os/42',oss:'oss-phase-42'},
  43:{name:'MarketingAutomationOS',dir:'phase-43-marketing-automation',route:'/api/company-os/43',oss:'oss-phase-43'},
  44:{name:'SupplierManagementOS',dir:'phase-44-supplier-management',route:'/api/company-os/44',oss:'oss-phase-44'},
  45:{name:'StoreExperienceOS',dir:'phase-45-store-experience',route:'/api/company-os/45',oss:'oss-phase-45'},
  46:{name:'QualityAssuranceOS',dir:'phase-46-quality-assurance',route:'/api/company-os/46',oss:'oss-phase-46'},
  47:{name:'DisasterRecoveryOS',dir:'phase-47-disaster-recovery',route:'/api/company-os/47',oss:'oss-phase-47'},
  48:{name:'KnowledgeManagementOS',dir:'phase-48-knowledge-management',route:'/api/company-os/48',oss:'oss-phase-48'},
  49:{name:'InvestorRelationsOS',dir:'phase-49-investor-relations',route:'/api/company-os/49',oss:'oss-phase-49'},
  50:{name:'StrategicPlanningOS',dir:'phase-50-strategic-planning',route:'/api/company-os/50',oss:'oss-phase-50'},
};
for(const [id,ph] of Object.entries(PHASES_MAP)){
  check('Phase '+id+' has dir',()=>assert.ok(ph.dir&&ph.dir.length>0));
  check('Phase '+id+' has route',()=>assert.ok(ph.route&&ph.route.length>0));
  check('Phase '+id+' has oss',()=>assert.ok(ph.oss&&ph.oss.length>0));
}
const seen=[];for(const id of Object.keys(PHASES_MAP)){check('no duplicate phase '+id,()=>{if(seen.includes(id))throw new Error('dup');seen.push(id);return true;});}
console.log('\n  RESULT: '+passed+' passed, '+failed+' failed');
process.exit(failed===0?0:1);
