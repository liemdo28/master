'use strict';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as assert from 'assert';
let passed=0,failed=0;
const check=(n,fn)=>{try{fn();passed++;console.log('  PASS: '+n);}catch(e){failed++;console.error('  FAIL: '+n+' -- '+e.message);}};
console.log('PHASE 31-40 DUPLICATE PROOF TEST\n');
const __testDir = fileURLToPath(new URL('.', import.meta.url));

// Workflow Fabric dedupe
const wfAbs = path.resolve(__testDir, '..', '..', 'agent-engine', 'phase-28-workflow-fabric-os', 'src', 'orchestrator.js');
const wfMod = await import('file:///' + wfAbs.replace(/\\/g, '/'));
const WorkflowFabric2OS = wfMod.default||wfMod.WorkflowFabric2OS;
const wf = new WorkflowFabric2OS({});
const r1=wf.handleTrigger({workflowId:'dedup-test',name:'Dedup Test',owner:'ops',division:'operations',trigger:'cron:daily',outcome:'success',durationMs:1000,approved:true});
check('first trigger runs',()=>assert.ok(r1.execution!==null));
const r2=wf.handleTrigger({workflowId:'dedup-test',name:'Dedup Test',owner:'ops',division:'operations',trigger:'cron:daily',outcome:'success',durationMs:1100,approved:true});
check('second same trigger is duplicate',()=>assert.strictEqual(r2.dedupResult.duplicate,true));
check('duplicate preserves one exec',()=>assert.strictEqual(r2.execution,null));

// Semantic workflow
const wfIntAbs = path.resolve(__testDir, '..', 'server', 'dist', 'workflow-intelligence', 'index.js');
const wfIntMod = await import('file:///' + wfIntAbs.replace(/\\/g, '/'));
const semanticRun = wfIntMod.runSemanticWorkflow;
check('semantic-workflow available',()=>assert.strictEqual(typeof semanticRun,'function'));
const result = semanticRun('Increase Raw Sushi online revenue 10%');
check('produces objective',()=>assert.ok(result.objective&&result.objective.length>0));
check('produces steps',()=>assert.ok(Array.isArray(result.steps)&&result.steps.length>0));
check('has duplicatesAvoided field',()=>assert.ok('duplicatesAvoided' in result));

console.log('\n  RESULT: '+passed+' passed, '+failed+' failed');
process.exit(failed===0?0:1);
