'use strict';
import * as assert from 'assert';
let passed=0,failed=0;
const check=(n,f)=>{try{f();passed++;console.log('  PASS: '+n);}catch(e){failed++;console.error('  FAIL: '+n+' -- '+e.message);}};
console.log('PHASE 41-50 DUPLICATE PROOF TEST\n');
async function runPhase(num,folder,cls){
  const m=await import('../../agent-engine/'+folder+'/src/orchestrator.js');
  const c=m[cls];
  const inst=new c();
  const r1=inst.register({signal:'test-signal'});
  const r2=inst.register({signal:'test-signal'});
  check('Phase '+num+' signals are unique IDs',()=>assert.notStrictEqual(r1.id,r2.id));
  check('Phase '+num+' second timestamp >= first',()=>assert.ok(r2.timestamp>=r1.timestamp));
}
const PHASES=[[41,'phase-41-ai-customer-support','AICustomerSupportOS'],[42,'phase-42-tax-compliance','TaxComplianceOS'],[43,'phase-43-marketing-automation','MarketingAutomationOS'],[44,'phase-44-supplier-management','SupplierManagementOS'],[45,'phase-45-store-experience','StoreExperienceOS'],[46,'phase-46-quality-assurance','QualityAssuranceOS'],[47,'phase-47-disaster-recovery','DisasterRecoveryOS'],[48,'phase-48-knowledge-management','KnowledgeManagementOS'],[49,'phase-49-investor-relations','InvestorRelationsOS'],[50,'phase-50-strategic-planning','StrategicPlanningOS']];
for(const [num,folder,cls] of PHASES){await runPhase(num,folder,cls);}
console.log('\n  RESULT: '+passed+' passed, '+failed+' failed');
process.exit(failed===0?0:1);