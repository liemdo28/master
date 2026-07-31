// Minimal CLI for the Phase 1 task runtime. No UI yet — this satisfies the
// "minimal task API" deliverable for this vertical slice.
//
// Usage:
//   tsx src/task-runtime/cli.ts create "inspect the repo"
//   tsx src/task-runtime/cli.ts list
//   tsx src/task-runtime/cli.ts show <taskId>
//   tsx src/task-runtime/cli.ts events <taskId>

import { TaskStore } from './store';
import { TaskEngine } from './engine';

function main() {
  const [, , cmd, ...rest] = process.argv;
  const store = new TaskStore();
  const engine = new TaskEngine(store);

  try {
    switch (cmd) {
      case 'create': {
        const userRequest = rest.join(' ') || 'unspecified request';
        const task = engine.createTask({ userRequest });
        console.log(JSON.stringify(task, null, 2));
        break;
      }
      case 'list': {
        console.log(JSON.stringify(store.listTasks(), null, 2));
        break;
      }
      case 'show': {
        const [taskId] = rest;
        console.log(JSON.stringify(store.getTask(taskId), null, 2));
        break;
      }
      case 'events': {
        const [taskId] = rest;
        console.log(JSON.stringify(store.listEvents(taskId), null, 2));
        break;
      }
      default:
        console.error('Unknown command. Use: create <request> | list | show <id> | events <id>');
        process.exitCode = 1;
    }
  } finally {
    store.close();
  }
}

main();
