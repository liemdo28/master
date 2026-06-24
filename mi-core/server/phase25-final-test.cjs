const O = require('./dist/objective-engine');
const X = require('./dist/execution-orchestrator');
const A = require('./dist/auto-task-engine');
const T = require('./dist/digital-twin');
const E = require('./dist/evidence-enforcer');

const obj = O.createObjective('Mi, increase Bakudan traffic by 20%.');
O.approveObjective(obj.id, 'cto-final-test', 'Phase 25 final autonomy test');
const plan = X.executePlan(obj.id);
const verification = X.verifyCompletion(obj.id);
const report = O.generateObjectiveReport(obj.id);
const autoTask = A.generateTaskFromSignal({ type: 'traffic-drop', data: { source: 'cto-final-test', dropPct: 20 } });
A.assignOwner(autoTask.id);
const score = T.computeCompanyScore();
const evidence = E.verifyObjective(obj.id);

console.log(JSON.stringify({
  objective_id: obj.id,
  tasks: plan.tasks.length,
  departments: obj.departments,
  plan_status: plan.status,
  verification,
  report_summary: report.summary,
  auto_task: autoTask.id,
  MI_COMPANY_SCORE: score.companyScore,
  evidence: { passed: evidence.passed, score: evidence.overallScore, count: evidence.evidenceCount }
}, null, 2));
