import { PersonalOsService } from './service';

const cmd = process.argv[2] ?? 'help';
const args = process.argv.slice(3);

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const service = new PersonalOsService();
  try {
    if (cmd === 'preference') {
      const sub = args[0];
      if (sub === 'list') return print({ preferences: service.store.listPreferences() });
      if (sub === 'add') return print(service.createPreference({ category: args[1], key: args[2], value: args.slice(3).join(' ') }));
      if (sub === 'remove') return print(service.store.deletePreference(args[1]));
    }
    if (cmd === 'goal') {
      const sub = args[0];
      if (sub === 'list') return print({ goals: service.store.listGoals() });
      if (sub === 'create') return print(service.store.createGoal({ title: args.join(' '), projectIds: ['mi-core'] }));
      if (sub === 'show') return print(service.store.getGoal(args[1]));
      if (sub === 'plan') return print(service.planGoal(args[1]));
      if (sub === 'activate') return print(service.store.updateGoalStatus(args[1], 'ACTIVE'));
      if (sub === 'pause') return print(service.store.updateGoalStatus(args[1], 'PAUSED'));
    }
    if (cmd === 'brief') {
      if (args[0] === 'generate') return print(service.generateDailyBrief());
      if (args[0] === 'show') return print(service.store.latestDailyBrief());
    }
    if (cmd === 'knowledge') {
      const sub = args[0];
      if (sub === 'list') return print({ knowledge: service.store.listKnowledge(args.includes('--include-inactive')) });
      if (sub === 'add') {
        const [kind, title, ...contentParts] = args.slice(1);
        const content = contentParts.join(' ');
        return print(service.createKnowledge({
          kind: kind as any,
          title,
          summary: content.slice(0, 500),
          content,
          provenance: 'personal-os cli',
          sourceType: 'USER_STATEMENT',
        }));
      }
      if (sub === 'search') return print({ results: service.searchKnowledge({ query: args.slice(1).join(' '), includeUnconfirmed: true }) });
      if (sub === 'confirm') return print(service.store.confirmKnowledge(args[1]));
      if (sub === 'remove') return print(service.store.deleteKnowledge(args[1]));
    }
    if (cmd === 'memory-pack') {
      return print(service.buildMemoryPack({ query: args.join(' '), policy: 'PERSONAL_AND_PROJECT', includeUnconfirmed: true }));
    }
    if (cmd === 'actions') {
      const { ControlledActionService } = await import('./actions/service');
      const actionService = new ControlledActionService();
      try {
        const sub = args[0] ?? 'list';
        if (sub === 'list') return print({ actions: actionService.list(args[1] as any) });
        if (sub === 'show') return print(actionService.detail(args[1]));
        if (sub === 'approve') {
          const detail = actionService.detail(args[1]);
          console.log(`Preview:\n${detail.proposal.preview.text}\n`);
          console.log(`Risk: ${detail.proposal.riskClass}`);
          console.log(`Target: ${detail.proposal.targetSystem}`);
          console.log(`Payload hash: ${detail.proposal.payloadHash}`);
          const decision = detail.governance.latestDecision ?? actionService.policyEngine.evaluate({ proposal: detail.proposal, stage: 'approval', actor: 'cli-user' });
          console.log(`Policy decision: ${decision.decision}`);
          console.log(`Approval level: ${decision.requiredApprovalLevel}`);
          console.log(`Decision hash: ${decision.decisionHash}`);
          const confirmation = args.includes('--strong-confirm')
            ? `CONFIRM:${detail.proposal.id} ${decision.decisionHash.slice(0, 12)}`
            : undefined;
          return print(await actionService.approve(args[1], { source: 'cli', approver: 'cli-user', strongConfirmation: confirmation }));
        }
        if (sub === 'reject') return print(actionService.reject(args[1], { source: 'cli', approver: 'cli-user', reason: args.slice(2).join(' ') || 'Rejected from CLI' }));
        if (sub === 'execute') return print(await actionService.execute(args[1]));
        if (sub === 'lockdown') {
          const item = actionService.policyEngine.killSwitch.lockdown('cli-user');
          actionService.policyEngine.audit.record({ eventType: 'kill_switch.enabled', policyVersion: null, inputHash: null, decisionHash: null, actor: 'cli-user', proposalId: null, reasons: [item.reason], metadata: { id: item.id, scope: item.scope } });
          return print(item);
        }
        if (sub === 'unlock') {
          const item = actionService.policyEngine.killSwitch.unlock(args[1] || 'missing');
          actionService.policyEngine.audit.record({ eventType: 'kill_switch.disabled', policyVersion: null, inputHash: null, decisionHash: null, actor: 'cli-user', proposalId: null, reasons: ['Kill switch disabled from local CLI.'], metadata: { id: item.id } });
          return print(item);
        }
      } finally { actionService.close(); }
    }
    if (cmd === 'governance') {
      const { ControlledActionService } = await import('./actions/service');
      const actionService = new ControlledActionService();
      try {
        const sub = args[0] ?? 'status';
        const store = actionService.policyEngine.store;
        if (sub === 'status') return print({
          activePolicy: store.activePolicySet(),
          killSwitches: store.listKillSwitches(),
          budgets: store.listBudgets(),
          anomalies: store.listAnomalies(),
        });
        if (sub === 'policies') return print({ policies: store.listPolicySets() });
        if (sub === 'simulate') return print({ policyId: args[1], changed: [], note: 'Run phase5g:acceptance for the full deterministic fixture simulation.' });
        if (sub === 'activate') throw new Error('policy activation requires explicit approved draft flow; no --force exists');
        if (sub === 'budgets') return print({ budgets: store.listBudgets() });
        if (sub === 'anomalies') return print({ anomalies: store.listAnomalies() });
      } finally { actionService.close(); }
    }
    // Phase 5D-3 daily operating loop. Approving a plan only changes its status —
    // it never executes a task.
    if (cmd === 'today') {
      const { DailyOperatingLoop } = await import('./operating/loop');
      const sub = args[0];
      const loop = new DailyOperatingLoop();
      try {
        if (!sub || sub === 'generate') return print(await loop.morning());
        if (sub === 'refresh') return print(await loop.midday());
        if (sub === 'plan') return print(loop.plan());
        if (sub === 'approve-plan') return print(loop.setPlanStatus(args[1], 'APPROVED'));
        if (sub === 'review') return print(await loop.evening());
      } finally { loop.close(); }
    }
    if (cmd === 'week') {
      const { DailyOperatingLoop } = await import('./operating/loop');
      const loop = new DailyOperatingLoop();
      try { return print(await loop.weekly()); } finally { loop.close(); }
    }
    if (cmd === 'approvals') {
      const { DailyOperatingLoop } = await import('./operating/loop');
      const { listPendingApprovals } = await import('./operating/approvals');
      const loop = new DailyOperatingLoop();
      try { return print({ approvals: listPendingApprovals(loop) }); } finally { loop.close(); }
    }
    if (cmd === 'project-health') {
      const { DailyOperatingLoop } = await import('./operating/loop');
      const { computeProjectHealth } = await import('./operating/health');
      const loop = new DailyOperatingLoop();
      try {
        if (args[0]) return print(computeProjectHealth(args[0], loop));
        const goals = loop.personalStore.listGoals().filter(g => ['DRAFT', 'ACTIVE', 'PAUSED', 'BLOCKED'].includes(g.status));
        const projectIds = [...new Set(goals.flatMap(g => g.projectIds))];
        return print({ projectHealth: projectIds.map(pid => computeProjectHealth(pid, loop)) });
      } finally { loop.close(); }
    }
    if (cmd === 'service-health') {
      const { computeServiceHealth } = await import('./operating/health');
      return print({ serviceHealth: await computeServiceHealth() });
    }
    // Phase 5C read-only intelligence. No mutation subcommand exists.
    // Phase 5D-1 document foundation. Read/ingest only — there is deliberately no
    // ingest-all, full-rebuild or watch-all subcommand.
    if (cmd === 'docs') {
      const { runDocumentsCli } = await import('../personal-os/documents/cli');
      return print(await runDocumentsCli(args));
    }
    if (cmd === 'calendar' || cmd === 'email' || cmd === 'agenda' || cmd === 'weekly-review' || cmd === 'follow-ups') {
      const { runIntelligenceCli } = await import('../intelligence/cli');
      return print(await runIntelligenceCli(cmd, args));
    }
    console.log(`Usage:
  personal-os preference list|add <category> <key> <value>|remove <id>
  personal-os goal create <title>|list|show <id>|plan <id>|activate <id>|pause <id>
  personal-os brief generate|show
  personal-os knowledge list|add <kind> <title> <content>|search <query>|confirm <id>|remove <id>
  personal-os memory-pack <query>
  personal-os actions list [status]|show <id>|approve <id> [--strong-confirm]|reject <id> [reason]|execute <id>|lockdown|unlock <killSwitchId>
  personal-os governance status|policies|simulate <policyId>|activate <policyId>|budgets|anomalies
  personal-os today [generate|refresh|plan|approve-plan <planId>|review]
  personal-os week
  personal-os approvals
  personal-os project-health [projectId]
  personal-os service-health
  personal-os calendar today|week
  personal-os email search "<query>"|thread "<id>"
  personal-os agenda
  personal-os weekly-review
  personal-os follow-ups
  personal-os docs discover <projectId>|ingest <approved-path>|list|show <id>|reindex <id>|stale`);
  } finally {
    service.close();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
