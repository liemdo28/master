#!/usr/bin/env node
// ============================================================
// agentctl — CEO CLI entry point
// ============================================================

import { Command } from 'commander';
import chalk from 'chalk';
import { AgentctlApi } from './api';
import { loadConfig, getConfigPath } from './config';

const program = new Command();

program
  .name('agentctl')
  .description('CEO CLI for Agent OS — control your PC from your laptop')
  .version('0.2.0')
  .option('--json', 'Output results as JSON')
  .option('--control-url <url>', 'Override control plane URL')
  .option('--worker <name>', 'Default worker name');

// ── ping ─────────────────────────────────────────────────────────────────

program
  .command('ping [worker]')
  .description('Ping a worker, measure latency')
  .action(async (workerName?: string) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      const result = await api.ping(workerName);
      console.log(`pong from ${chalk.green(result.worker)}, latency ${chalk.cyan(result.latencyMs + 'ms')}`);
      console.log(`  hostname: ${result.hostname || 'unknown'}`);
      console.log(`  status:   ${chalk.green('online')}`);
      if (result.version) console.log(`  version:  ${result.version}`);
    } catch (err: any) {
      console.error(chalk.red('✗ Ping failed:'), err.message);
      process.exit(1);
    }
  });

// ── workers ───────────────────────────────────────────────────────────────

const workersCmd = program.command('workers').description('Manage workers');

workersCmd
  .command('list')
  .description('List all registered workers')
  .action(async () => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      const workers = await api.listWorkers();
      if (workers.length === 0) {
        console.log(chalk.yellow('No workers registered'));
        return;
      }
      console.log(chalk.bold('\n hostname         status    last_seen      tags'));
      console.log(' '.repeat(60).replace(/ /g, '─'));
      for (const w of workers) {
        const ago = w.lastHeartbeat ? secondsAgo(w.lastHeartbeat) + ' ago' : 'never';
        const statusColor = w.status === 'online' ? chalk.green : chalk.red;
        console.log(
          ` ${w.name.padEnd(15)} ${statusColor(w.status.padEnd(8))} ${ago.padEnd(13)} ${(w as any).tags || ''}`
        );
      }
      console.log();
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

workersCmd
  .command('show <name>')
  .description('Show details for a worker')
  .action(async (name: string) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      const worker = await api.getWorker(name);
      if (!worker) {
        console.error(chalk.red('✗ Worker not found'));
        process.exit(1);
      }
      console.log(chalk.bold('\n Worker Details'));
      console.log(`  Name:         ${worker.name}`);
      console.log(`  Hostname:     ${worker.hostname}`);
      console.log(`  ID:           ${worker.id}`);
      console.log(`  Status:       ${worker.status}`);
      console.log(`  Registered:   ${worker.registeredAt}`);
      if (worker.lastHeartbeat) console.log(`  Last seen:    ${worker.lastHeartbeat}`);
      if (worker.systemInfo) {
        console.log(`  System info:`);
        if (worker.systemInfo.os) console.log(`    OS:          ${worker.systemInfo.os}`);
        if (worker.systemInfo.cpu) console.log(`    CPU:         ${worker.systemInfo.cpu}`);
        if (worker.systemInfo.mem) console.log(`    RAM:         ${worker.systemInfo.mem}`);
      }
      console.log();
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

// ── exec ──────────────────────────────────────────────────────────────────

program
  .command('exec <command> [args...]')
  .description('Execute a command on a worker')
  .option('-w, --worker <name>', 'Target worker name')
  .option('-t, --timeout <sec>', 'Timeout in seconds', '60')
  .option('--no-stream', 'Disable streaming output')
  .action(async (command: string, args: string[], options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      const result = await api.exec({
        command,
        args,
        workerName: options.worker,
        timeoutSec: parseInt(options.timeout),
        stream: options.stream,
      });

      if (result.output) {
        process.stdout.write(result.output + '\n');
      }

      if (result.status === 'ok') {
        console.log(chalk.green(`\n✓ Task ${result.taskId} completed`));
        if (result.durationMs) console.log(`  Duration: ${result.durationMs}ms`);
      } else {
        console.error(chalk.red(`\n✗ Task ${result.status}: ${result.error}`));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

// ── shell ────────────────────────────────────────────────────────────────

program
  .command('shell <command>')
  .description('Run a shell command on a worker (convenience alias)')
  .option('-w, --worker <name>', 'Target worker name')
  .option('-t, --timeout <sec>', 'Timeout in seconds', '60')
  .action(async (command: string, options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      const result = await api.shell(command, options.worker, parseInt(options.timeout));
      if (result.output) {
        process.stdout.write(result.output + '\n');
      }
      if (result.status === 'ok') {
        console.log(chalk.green(`\n✓ exit_code: 0  duration_ms: ${result.durationMs || '?'}`));
      } else {
        console.error(chalk.red(`\n✗ ${result.status}: ${result.error}`));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

// ── tasks ─────────────────────────────────────────────────────────────────

const tasksCmd = program.command('tasks').description('Manage tasks');

tasksCmd
  .command('list')
  .description('List recent tasks')
  .option('-s, --status <status>', 'Filter by status (pending/running/completed/failed)')
  .option('-l, --limit <n>', 'Max tasks to show', '20')
  .action(async (options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      const tasks = await api.listTasks(options.status, parseInt(options.limit));
      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found'));
        return;
      }
      console.log(chalk.bold('\n id                  type        status       worker              created'));
      console.log(' '.repeat(85).replace(/ /g, '─'));
      for (const t of tasks) {
        const statusColor = t.status === 'completed' ? chalk.green
          : t.status === 'failed' ? chalk.red
          : t.status === 'running' ? chalk.cyan
          : chalk.yellow;
        const shortId = t.id.substring(0, 18);
        console.log(
          ` ${shortId.padEnd(18)} ${t.type.padEnd(11)} ${statusColor(t.status.padEnd(12))} ${(t.workerId || '-').substring(0, 18).padEnd(18)} ${t.createdAt.substring(0, 16)}`
        );
      }
      console.log();
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

tasksCmd
  .command('show <id>')
  .description('Show task details and logs')
  .action(async (id: string) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      const task = await api.getTask(id);
      console.log(chalk.bold('\n Task:'), task.id);
      console.log(`  Type:     ${task.type}`);
      console.log(`  Status:   ${task.status}`);
      console.log(`  Project:  ${task.project}`);
      console.log(`  Worker:   ${task.workerId || '-'}`);
      console.log(`  Created:  ${task.createdAt}`);
      if (task.startedAt) console.log(`  Started:  ${task.startedAt}`);
      if (task.completedAt) console.log(`  Finished: ${task.completedAt}`);
      if (task.error) console.log(chalk.red(`  Error:    ${task.error}`));

      console.log(chalk.bold('\n Logs:'));
      const logs = await api.getTaskLogs(id);
      for (const l of logs) {
        const levelColor = l.level === 'error' ? chalk.red
          : l.level === 'warn' ? chalk.yellow
          : chalk.dim;
        console.log(`  ${chalk.dim(l.timestamp.substring(11, 19))} ${levelColor('[' + l.level + ']')} ${l.message}`);
      }
      console.log();
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

tasksCmd
  .command('abort <id>')
  .description('Abort a running task')
  .action(async (id: string) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      await api.cancelTask(id);
      console.log(chalk.green(`✓ Task ${id} cancelled`));
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

// ── audit ──────────────────────────────────────────────────────────────────

program
  .command('audit <path>')
  .description('Run audit on a project path')
  .option('-w, --worker <name>', 'Target worker name')
  .option('-t, --timeout <sec>', 'Timeout in seconds', '300')
  .action(async (projectPath: string, options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    console.log(chalk.cyan(`→ Dispatching audit for ${projectPath} ...`));
    try {
      const result = await api.audit(projectPath, options.worker);
      console.log(chalk.green(`\n✓ Audit complete — task ${result.taskId}`));
      if (result.summary) console.log(`\nSummary: ${result.summary}`);
      if (result.reportPath) console.log(`Report:   ${result.reportPath}`);
    } catch (err: any) {
      console.error(chalk.red('✗ Audit failed:'), err.message);
      process.exit(1);
    }
  });

// ── services ──────────────────────────────────────────────────────────────

const servicesCmd = program.command('services').description('Manage long-running services');

servicesCmd
  .command('start <name>')
  .description('Start a service on a worker')
  .option('-w, --worker <name>', 'Target worker name')
  .action(async (name: string, options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    console.log(chalk.cyan(`→ Starting ${name} ...`));
    try {
      const result = await api.startService(name, options.worker);
      if (result.state === 'running') {
        console.log(chalk.green(`\n✓ ${name} started`));
        if (result.pid) console.log(`  PID:   ${result.pid}`);
        if (result.port) console.log(`  Port:  ${result.port}`);
      } else {
        console.error(chalk.red(`\n✗ ${name} failed to start`));
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

servicesCmd
  .command('stop <name>')
  .description('Stop a service on a worker')
  .option('-w, --worker <name>', 'Target worker name')
  .action(async (name: string, options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    console.log(chalk.cyan(`→ Stopping ${name} ...`));
    try {
      const result = await api.stopService(name, options.worker);
      console.log(result.state === 'stopped'
        ? chalk.green(`\n✓ ${name} stopped`)
        : chalk.yellow(`\n? ${name} state: ${result.state}`));
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

servicesCmd
  .command('status [name]')
  .description('Check service status')
  .option('-w, --worker <name>', 'Target worker name')
  .action(async (name: string | undefined, options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    if (name) {
      const result = await api.serviceStatus(name, options.worker);
      const color = result.state === 'running' ? chalk.green
        : result.state === 'stopped' ? chalk.red
        : chalk.yellow;
      console.log(`Service: ${name}`);
      console.log(`State:   ${color(result.state)}`);
      if (result.pid) console.log(`PID:     ${result.pid}`);
      if (result.uptimeSec) console.log(`Uptime: ${result.uptimeSec}s`);
      if (result.lastLines && result.lastLines.length > 0) {
        console.log(chalk.dim('\nLast logs:'));
        for (const l of result.lastLines.slice(-10)) console.log('  ' + chalk.dim(l));
      }
    } else {
      console.log(chalk.yellow('Usage: agentctl services status <name>'));
    }
  });

// ── logs ──────────────────────────────────────────────────────────────────

program
  .command('logs <resource>')
  .description('Stream or tail logs for a task or service')
  .option('-w, --worker <name>', 'Target worker name')
  .option('-t, --tail <n>', 'Number of lines to tail', '50')
  .option('-f, --follow', 'Follow/log stream mode')
  .action(async (resource: string, options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    try {
      // Try to detect if it's a task ID or a service name
      if (resource.includes('-') && resource.length > 20) {
        // Likely a task ID
        const logs = await api.getTaskLogs(resource);
        const tail = logs.slice(-parseInt(options.tail));
        for (const l of tail) {
          const levelColor = l.level === 'error' ? chalk.red : l.level === 'warn' ? chalk.yellow : chalk.dim;
          process.stdout.write(`${chalk.dim(l.timestamp.substring(11, 19))} ${levelColor('[' + l.level + ']')} ${l.message}\n`);
        }
      } else {
        // Service name
        const status = await api.serviceStatus(resource, options.worker);
        if (status.lastLines) {
          for (const l of status.lastLines.slice(-parseInt(options.tail))) {
            console.log(chalk.dim(l));
          }
        }
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Failed:'), err.message);
      process.exit(1);
    }
  });

// ── configure ──────────────────────────────────────────────────────────────

program
  .command('configure')
  .description('Set control plane URL and default worker')
  .option('--control-url <url>', 'Control plane URL')
  .option('--worker <name>', 'Default worker name')
  .action(async (options: any) => {
    const current = loadConfig();
    const newUrl = options.controlUrl || current.controlUrl;
    const newWorker = options.worker || current.workerName;
    const { saveConfig } = await import('./config');
    saveConfig({ controlUrl: newUrl, workerName: newWorker });
    console.log(chalk.green('✓ Configuration saved to'), getConfigPath());
    console.log(`  control-url: ${newUrl}`);
    console.log(`  worker:      ${newWorker}`);
  });

// ── status ─────────────────────────────────────────────────────────────────

program
  .command('status [resource]')
  .description('Show system or service status')
  .option('-w, --worker <name>', 'Target worker name')
  .action(async (resource: string | undefined, options: any) => {
    const api = new AgentctlApi({ ...loadConfig(), json: false });
    if (resource) {
      // Service status
      const result = await api.serviceStatus(resource, options.worker);
      const color = result.state === 'running' ? chalk.green : result.state === 'stopped' ? chalk.red : chalk.yellow;
      console.log(`Service: ${resource}`);
      console.log(`State:   ${color(result.state)}`);
      if (result.pid) console.log(`PID:     ${result.pid}`);
      if (result.uptimeSec) console.log(`Uptime: ${result.uptimeSec}s`);
    } else {
      // Overall status
      try {
        const workers = await api.listWorkers();
        const tasks = await api.listTasks(undefined, 5);
        console.log(chalk.bold('\n Agent OS Status'));
        console.log(`  Workers: ${workers.length} registered`);
        for (const w of workers) {
          const color = w.status === 'online' ? chalk.green : chalk.red;
          console.log(`    ${w.name}: ${color(w.status)}`);
        }
        console.log(`  Recent tasks: ${tasks.length}`);
        console.log(`  Control: ${chalk.dim(loadConfig().controlUrl)}`);
        console.log();
      } catch (err: any) {
        console.error(chalk.red('✗ Cannot reach control plane:'), err.message);
        process.exit(1);
      }
    }
  });

// ── Helper ────────────────────────────────────────────────────────────────

function secondsAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

// ── Run ──────────────────────────────────────────────────────────────────

program.parse(process.argv);
