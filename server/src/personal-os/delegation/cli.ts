import { DelegationService } from './service';
import type { CreateDelegationInput } from './types';

const cmd = process.argv[2] ?? 'help';
const args = process.argv.slice(3);

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// Deliberately no --yes / --force / --skip-policy / --unlimited / --forever /
// --ignore-budget flag exists anywhere in this CLI (directive §28).

async function main() {
  const service = new DelegationService();
  try {
    if (cmd === 'create') {
      const raw = await readStdin();
      const input = JSON.parse(raw) as CreateDelegationInput;
      const created = service.createDelegation(input);
      console.error('NOTE: delegation created in DRAFT. Run "delegation show <id>" to review the exact scope before approving.');
      return print(created);
    }
    if (cmd === 'list') return print({ delegations: service.list(args[0] as any) });
    if (cmd === 'show') {
      const d = service.get(args[0]);
      console.log(`Delegation ${d.id} v${d.delegationVersion} — ${d.status}
  project:        ${d.projectId}
  action types:   ${d.allowedActionTypes.join(', ')}
  window:         ${d.startsAt} -> ${d.expiresAt} (${d.timezone})
  risk ceiling:   ${d.riskCeiling}  approval ceiling: ${d.approvalLevelCeiling}
  quota:          ${d.usedExecutions}/${d.maxExecutions} executions, ${d.usedTargets}/${d.maxTargets ?? '∞'} targets
  target scope:   ${JSON.stringify(d.targetRestriction)}
`);
      return print(d);
    }
    if (cmd === 'submit') return print(service.submitForApproval(args[0]));
    if (cmd === 'approve' || cmd === 'activate') {
      const approver = flag('approver');
      const confirm = flag('confirm');
      if (!approver) throw new Error('--approver <name> is required (a human identity, never Mi/system/automation)');
      if (!confirm) throw new Error(`--confirm "AUTHORIZE:${args[0]}" is required — re-type the exact phrase deliberately, no shortcut flag exists`);
      const current = service.get(args[0]);
      console.log(`You are granting Mi temporary authority to perform these actions without asking for separate approval each time, within the limits shown:`);
      console.log(`  project:      ${current.projectId}`);
      console.log(`  action types: ${current.allowedActionTypes.join(', ')}`);
      console.log(`  window:       ${current.startsAt} -> ${current.expiresAt} (${current.timezone})`);
      console.log(`  risk ceiling: ${current.riskCeiling}`);
      console.log(`  max executions: ${current.maxExecutions}  max targets: ${current.maxTargets ?? 'unlimited-per-target (execution cap still applies)'}`);
      return print(service.approve(args[0], { approver, strongConfirmation: confirm }));
    }
    if (cmd === 'revoke') return print(service.revoke(args[0], flag('actor') || 'cli-user', args.slice(1).filter(a => !a.startsWith('--')).join(' ') || 'revoked by cli'));
    if (cmd === 'cancel') return print(service.cancel(args[0], flag('actor') || 'cli-user', args.slice(1).filter(a => !a.startsWith('--')).join(' ') || 'cancelled by cli'));
    if (cmd === 'evidence') return print(service.evidence(args[0]));
    if (cmd === 'help' || !cmd) {
      console.log(`delegation <command> [args]

  create                      read delegation JSON from stdin, create DRAFT v1
  list [status]                list delegations, optionally filtered by status
  show <id>                    delegation detail + current quota usage
  submit <id>                  DRAFT -> WAITING_APPROVAL
  approve <id> --approver <name> --confirm "AUTHORIZE:<id>"
                                strong approval; WAITING_APPROVAL -> ACTIVE. No shortcut
                                flag exists — approver and the exact confirm phrase are
                                both mandatory every time.
  activate <id> --approver <name> --confirm "AUTHORIZE:<id>"
                                alias of approve (idempotent if already ACTIVE)
  revoke <id> [reason] [--actor <name>]
                                immediately blocks further delegated execution
  cancel <id> [reason] [--actor <name>]
                                cancel a DRAFT/WAITING_APPROVAL delegation before activation
  evidence <id>                full event + decision audit trail

Mi may propose a delegation. Mi may never approve its own delegation — approve/activate
always require a human --approver identity and a deliberately re-typed confirmation.`);
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
