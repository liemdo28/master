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
    if (cmd === 'today') return print(service.generateDailyBrief());
    console.log(`Usage:
  personal-os preference list|add <category> <key> <value>|remove <id>
  personal-os goal create <title>|list|show <id>|plan <id>|activate <id>|pause <id>
  personal-os brief generate|show
  personal-os today`);
  } finally {
    service.close();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
