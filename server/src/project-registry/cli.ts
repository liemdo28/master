import { ProjectRegistryService, seedMiCoreProject } from './service';

async function main(): Promise<boolean> {
  const [command, ...args] = process.argv.slice(2);
  const service = new ProjectRegistryService();
  try {
    if (command === 'list') {
      console.log(JSON.stringify(service.listProjects(), null, 2));
      return true;
    }
    if (command === 'register-mi') {
      const root = args[0] ?? process.cwd();
      console.log(JSON.stringify(service.registerProject(seedMiCoreProject(root)), null, 2));
      return true;
    }
    if (command === 'register') {
      const [id, displayName, canonicalRoot] = args;
      if (!displayName || !canonicalRoot) throw new Error('Usage: register <id> <displayName> <canonicalRoot>');
      console.log(JSON.stringify(service.registerProject({ id, displayName, canonicalRoot }), null, 2));
      return true;
    }
    if (command === 'verify') {
      console.log(JSON.stringify(service.verifyProject(required(args[0], 'projectId')), null, 2));
      return true;
    }
    if (command === 'map') {
      console.log(JSON.stringify(service.generateProjectMap(required(args[0], 'projectId')), null, 2));
      return true;
    }
    if (command === 'map-status') {
      console.log(JSON.stringify(service.getMapStatus(required(args[0], 'projectId')), null, 2));
      return true;
    }
    if (command === 'context-pack') {
      const [projectId, ...requestParts] = args;
      console.log(JSON.stringify(service.buildContextPack(required(projectId, 'projectId'), requestParts.join(' ')), null, 2));
      return true;
    }
    printUsage();
    return false;
  } finally {
    service.close();
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function printUsage(): void {
  console.error([
    'Usage:',
    '  tsx src/project-registry/cli.ts list',
    '  tsx src/project-registry/cli.ts register-mi <repoRoot>',
    '  tsx src/project-registry/cli.ts register <id> <displayName> <canonicalRoot>',
    '  tsx src/project-registry/cli.ts verify <projectId>',
    '  tsx src/project-registry/cli.ts map <projectId>',
    '  tsx src/project-registry/cli.ts map-status <projectId>',
    '  tsx src/project-registry/cli.ts context-pack <projectId> <request>',
  ].join('\n'));
}

main()
  .then(ok => {
    if (!ok) process.exitCode = 1;
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
