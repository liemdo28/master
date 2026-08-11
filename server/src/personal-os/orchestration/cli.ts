import { GovernedOrchestrationService } from './service';
import type { ActionPlanStepInput } from './types';

const cmd = process.argv[2] ?? 'help';
const args = process.argv.slice(3);

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main() {
  const service = new GovernedOrchestrationService();
  try {
    if (cmd === 'create') {
      // Reads a JSON plan definition from stdin: {title, objective, projectId?, goalId?, steps:[...]}.
      const raw = await readStdin();
      const input = JSON.parse(raw) as { title: string; objective: string; projectId?: string; goalId?: string; steps: ActionPlanStepInput[] };
      return print(service.createPlan(input));
    }
    if (cmd === 'list') return print({ plans: service.list(args[0] as any) });
    if (cmd === 'show') return print(service.detail(args[0]));
    if (cmd === 'validate') {
      const result = service.validate(args[0]);
      console.error('NOTE: this validates PLAN STRUCTURE only. It never approves a Controlled Action.');
      return print(result);
    }
    if (cmd === 'start') return print(service.start(args[0]));
    if (cmd === 'advance') return print(await service.advance(args[0], { triggeredBy: 'cli-user', idempotencyKey: flag('idempotency-key') }));
    if (cmd === 'pause') return print(service.pause(args[0], args.slice(1).join(' ') || 'paused by cli'));
    if (cmd === 'resume') return print(service.resume(args[0]));
    if (cmd === 'cancel') return print(service.cancel(args[0], args.slice(1).join(' ') || 'cancelled by cli'));
    if (cmd === 'evidence') return print({ evidence: service.evidence(args[0]) });
    if (cmd === 'help' || !cmd) {
      console.log(`plan-action <command> [args]

  create              read plan JSON from stdin, create plan version 1
  list [status]       list plans, optionally filtered by status
  show <planId>       plan + steps
  validate <planId>   validate PLAN STRUCTURE only (never approves a Controlled Action)
  start <planId>      VALIDATED -> READY
  advance <planId>    advance eligible steps once (idempotent; --idempotency-key <key>)
  pause <planId> [reason]
  resume <planId>     never auto-executes a WAITING_APPROVAL step
  cancel <planId> [reason]
  evidence <planId>   full audit trail

To approve a Controlled Action step, use the existing actions CLI
(server npm run personal-os -- actions approve <proposalId>), never this one —
approving a plan's structure is a different operation from approving an action.`);
      return;
    }
    console.error(`unknown command: ${cmd}`);
    process.exitCode = 1;
  } finally {
    service.close();
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
