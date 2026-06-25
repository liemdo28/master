import { sendToCeo, queueToCeo } from '../services/whatsapp-sender';
import { getTask } from './engineering-queue';
import { getEvidence } from './evidence-engine';

export async function escalateToHuman(taskId: string, reason: string): Promise<boolean> {
  const task = getTask(taskId); const evidence = getEvidence(taskId);
  if (!task) { queueToCeo(`⚠️ Mi Engineering: escalation for unknown task ${taskId}`); return false; }
  const routing = typeof task.routing === 'string' ? JSON.parse(task.routing) : (task.routing || {});
  const cls = typeof task.classification === 'string' ? JSON.parse(task.classification) : (task.classification || {});
  const msg = [`⚠️ *Mi Engineering — Human Approval Required*`, ``, `*Task:* \`${taskId}\``, `*Objective:* ${task.objective.slice(0,150)}`, `*Domain:* ${cls.domain || '?'} | *Complexity:* ${cls.complexity || '?'}`, `*Model:* ${routing.model_name || task.selected_model || '?'}`, `*Reason:* ${reason}`, `*Evidence:* ${evidence.length} record(s)`, ``, `Reply:`, `• \`approve ${taskId}\` — approve`, `• \`reject ${taskId}\` — reject`].join('\n');
  try { const sent = await sendToCeo(msg); if (!sent) queueToCeo(msg); return true; } catch { queueToCeo(msg); return false; }
}

export async function notifyTaskComplete(taskId: string, status: 'DONE' | 'FAILED'): Promise<void> {
  const task = getTask(taskId); if (!task) return;
  const routing = typeof task.routing === 'string' ? JSON.parse(task.routing) : (task.routing || {});
  queueToCeo([`${status === 'DONE' ? '✅' : '❌'} *Engineering Task ${status}*`, `Task: \`${taskId}\``, `Objective: ${task.objective.slice(0,100)}`, `Model: ${routing.model_name || task.selected_model}`].join('\n'));
}

export async function notifyP0(taskId: string, objective: string): Promise<void> {
  const msg = [`🚨 *P0 ESCALATION — Immediate Human Required*`, `Task: \`${taskId}\``, `Objective: ${objective.slice(0,200)}`, `Action: Mi has halted auto-execution. Review and approve manually.`].join('\n');
  try { await sendToCeo(msg); } catch { queueToCeo(msg); }
}
