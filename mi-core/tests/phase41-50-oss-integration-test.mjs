'use strict';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as assert from 'assert';
const __testDir = fileURLToPath(new URL('.', import.meta.url));
const abs = path.resolve(__testDir, '..', 'server', 'dist', 'oss-runtime', 'index.js');
const ossMod = await import('file:///' + abs.replace(/\\/g, '/'));
let passed=0,failed=0;
const check=(n,f)=>{try{f();passed++;console.log('  PASS: '+n);}catch(e){failed++;console.error('  FAIL: '+n+' -- '+e.message);}};
console.log('PHASE 41-50 OSS INTEGRATION TEST\n');
const selectWorkerForPhase = ossMod.selectWorkerForPhase;
const ossRuntimeSummary = ossMod.ossRuntimeSummary;
check('selectWorkerForPhase available',()=>assert.strictEqual(typeof selectWorkerForPhase,'function'));
const summary = ossRuntimeSummary();
check('oss-runtime workers >= 39',()=>assert.ok(typeof summary.workers==='number'&&summary.workers>=39));
{const w=selectWorkerForPhase(41);check('Phase 41 selects worker',()=>assert.ok(w!==null));check('Phase 41 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 41 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(42);check('Phase 42 selects worker',()=>assert.ok(w!==null));check('Phase 42 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 42 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(43);check('Phase 43 selects worker',()=>assert.ok(w!==null));check('Phase 43 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 43 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(44);check('Phase 44 selects worker',()=>assert.ok(w!==null));check('Phase 44 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 44 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(45);check('Phase 45 selects worker',()=>assert.ok(w!==null));check('Phase 45 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 45 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(46);check('Phase 46 selects worker',()=>assert.ok(w!==null));check('Phase 46 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 46 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(47);check('Phase 47 selects worker',()=>assert.ok(w!==null));check('Phase 47 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 47 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(48);check('Phase 48 selects worker',()=>assert.ok(w!==null));check('Phase 48 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 48 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(49);check('Phase 49 selects worker',()=>assert.ok(w!==null));check('Phase 49 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 49 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}
{const w=selectWorkerForPhase(50);check('Phase 50 selects worker',()=>assert.ok(w!==null));check('Phase 50 worker has name',()=>assert.ok(w&&w.worker&&w.worker.name));check('Phase 50 health status',()=>assert.ok(w&&(w.status==='CONFIGURED_NOT_INSTALLED'||w.status==='INTEGRATED_RUNNING')));}

console.log('\n  RESULT: '+passed+' passed, '+failed+' failed');
process.exit(failed===0?0:1);
