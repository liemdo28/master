import { EvidenceService } from './service';

// Read-only. No create/mutate/resolve/dismiss command exists — the evidence contract
// has no mutation surface at all (§6D.10).

const cmd = process.argv[2] ?? 'help';
const args = process.argv.slice(3);

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const service = new EvidenceService();
  try {
    if (cmd === 'list') {
      const [sourceSystem, category] = args;
      return print({ evidence: service.list({ sourceSystem: sourceSystem as any, category: category as any }) });
    }
    if (cmd === 'get') return print({ evidence: service.get(args[0]) });
    if (cmd === 'conflicts') return print({ conflicts: service.conflicts() });
    if (cmd === 'health') return print({ health: service.health() });
    if (cmd === 'digest') return print({ digest: service.digest(args[0] || new Date().toISOString().slice(0, 10)) });
    console.log(`Usage: evidence <list [sourceSystem] [category] | get <id> | conflicts | health | digest [YYYY-MM-DD]>`);
  } finally {
    service.close();
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
