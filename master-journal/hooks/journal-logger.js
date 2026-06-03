/**
 * Master Journal Auto Hook
 * 
 * Automatically logs events from the Master Intelligence Layer.
 * Records: task lifecycle, build/deploy, QA runs, git actions, snapshots.
 * 
 * Usage:
 *   node journal-logger.js --log <event-type> --project <name> --data <json>
 *   node journal-logger.js --list
 *   node journal-logger.js --query --project <name>
 *   node journal-logger.js --stats
 */

const fs = require('fs');
const path = require('path');

const JOURNAL_DIR = path.join(__dirname, '..', 'events');
const DB_DIR = path.join(__dirname, '..', 'db');

// ─── Event Types ─────────────────────────────────────────────────────────────

const EVENT_TYPES = {
  // Task events
  'task_created': 'Task created',
  'task_started': 'Task started',
  'task_completed': 'Task completed',
  'task_failed': 'Task failed',
  'task_cancelled': 'Task cancelled',
  'task_killed': 'Task killed',
  
  // Indexer events
  'indexer_run_started': 'Indexer run started',
  'indexer_run_completed': 'Indexer run completed',
  'project_dna_generated': 'Project DNA generated',
  'dependency_graph_generated': 'Dependency graph built',
  
  // Build events
  'build_started': 'Build started',
  'build_completed': 'Build completed',
  'build_failed': 'Build failed',
  
  // Deploy events
  'deploy_started': 'Deploy started',
  'deploy_completed': 'Deploy completed',
  'deploy_failed': 'Deploy failed',
  'deploy_rollback': 'Rollback executed',
  
  // QA events
  'qa_started': 'QA run started',
  'qa_completed': 'QA run completed',
  'qa_failed': 'QA run failed',
  
  // Git events
  'git_status_checked': 'Git status checked',
  'git_commit_created': 'Git commit created',
  'git_push_started': 'Git push started',
  'git_push_completed': 'Git push completed',
  'git_merge_completed': 'Git merge completed',
  
  // Snapshot events
  'snapshot_started': 'Snapshot started',
  'snapshot_completed': 'Snapshot completed',
  
  // Artifact events
  'artifact_added': 'Artifact added',
  'artifact_removed': 'Artifact removed',
  
  // Approval events
  'approval_requested': 'Approval requested',
  'approval_approved': 'Approval approved',
  'approval_denied': 'Approval denied',
  
  // Control events
  'control_ping': 'Control ping',
  'worker_online': 'Worker online',
  'worker_offline': 'Worker offline',
};

// ─── UUID Generator ────────────────────────────────────────────────────────────

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function now() { return new Date().toISOString(); }

// ─── Journal File ─────────────────────────────────────────────────────────────

function getTodayFile() {
  const today = new Date().toISOString().split('T')[0];
  const filePath = path.join(JOURNAL_DIR, `${today}.jsonl`);
  if (!fs.existsSync(JOURNAL_DIR)) fs.mkdirSync(JOURNAL_DIR, { recursive: true });
  return filePath;
}

// ─── Log Event ────────────────────────────────────────────────────────────────

function logEvent({ type, project, actor = 'system', data = {}, riskLevel = 'unknown', taskId = null }) {
  if (!EVENT_TYPES[type]) {
    console.error(`Unknown event type: ${type}`);
    return null;
  }
  
  const event = {
    id: uuid(),
    event_id: `evt_${uuid().replace(/-/g, '').substring(0, 12)}`,
    timestamp: now(),
    type,
    project: project || 'E:\\Project\\Master',
    actor,
    task_id: taskId || uuid(),
    risk: riskLevel,
    data,
  };
  
  const file = getTodayFile();
  fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
  
  return event;
}

// ─── Query Events ─────────────────────────────────────────────────────────────

function readEvents(filePath = null) {
  const file = filePath || getTodayFile();
  if (!fs.existsSync(file)) return [];
  
  return fs.readFileSync(file, 'utf8')
    .trim().split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function queryEvents({ type, project, actor, from, to, limit = 100 }) {
  let events = readEvents();
  
  if (type) events = events.filter(e => e.type === type);
  if (project) events = events.filter(e => e.project === project);
  if (actor) events = events.filter(e => e.actor === actor);
  
  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return events.slice(0, limit);
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function getStats() {
  const events = readEvents();
  
  const byType = {};
  const byProject = {};
  const byActor = {};
  let tasks = 0, completed = 0, failed = 0;
  
  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byProject[e.project] = (byProject[e.project] || 0) + 1;
    byActor[e.actor] = (byActor[e.actor] || 0) + 1;
    
    if (e.type.includes('task')) tasks++;
    if (e.type === 'task_completed') completed++;
    if (e.type === 'task_failed') failed++;
  }
  
  return {
    total: events.length,
    tasks,
    completed,
    failed,
    success_rate: tasks > 0 ? Math.round(completed / tasks * 100) : 0,
    by_type: byType,
    by_project: byProject,
    by_actor: byActor,
    first_event: events[events.length - 1]?.timestamp || null,
    last_event: events[0]?.timestamp || null,
  };
}

// ─── CLI Interface ───────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--log') || args.includes('-l')) {
    const typeIdx = args.indexOf('--log') + 1 || args.indexOf('-l') + 1;
    const projectIdx = args.indexOf('--project') !== -1 ? args.indexOf('--project') + 1 : -1;
    const actorIdx = args.indexOf('--actor') !== -1 ? args.indexOf('--actor') + 1 : -1;
    const dataIdx = args.indexOf('--data') !== -1 ? args.indexOf('--data') + 1 : -1;
    const riskIdx = args.indexOf('--risk') !== -1 ? args.indexOf('--risk') + 1 : -1;
    
    const type = args[typeIdx];
    const project = projectIdx > 0 ? args[projectIdx] : 'E:\\Project\\Master';
    const actor = actorIdx > 0 ? args[actorIdx] : 'system';
    const data = dataIdx > 0 ? JSON.parse(args[dataIdx]) : {};
    const risk = riskIdx > 0 ? args[riskIdx] : 'unknown';
    
    const event = logEvent({ type, project, actor, data, riskLevel: risk });
    if (event) {
      console.log('Logged:', event.id, type, '->', project);
    }
    return;
  }
  
  if (args.includes('--list') || args.includes('-L')) {
    console.log('\n=== Available Event Types ===\n');
    for (const [type, desc] of Object.entries(EVENT_TYPES)) {
      console.log(`  ${type.padEnd(30)} ${desc}`);
    }
    console.log();
    return;
  }
  
  if (args.includes('--query') || args.includes('-q')) {
    const projectIdx = args.indexOf('--project') !== -1 ? args.indexOf('--project') + 1 : -1;
    const typeIdx = args.indexOf('--type') !== -1 ? args.indexOf('--type') + 1 : -1;
    const limitIdx = args.indexOf('--limit') !== -1 ? args.indexOf('--limit') + 1 : -1;
    
    const opts = {};
    if (projectIdx > 0) opts.project = args[projectIdx];
    if (typeIdx > 0) opts.type = args[typeIdx];
    if (limitIdx > 0) opts.limit = parseInt(args[limitIdx]);
    
    const events = queryEvents(opts);
    console.log(`\n=== Found ${events.length} events ===\n`);
    for (const e of events.slice(0, 20)) {
      const t = new Date(e.timestamp).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      console.log(`  [${t}] ${e.type} (${e.actor}) -> ${e.project}`);
    }
    console.log();
    return;
  }
  
  if (args.includes('--stats')) {
    const stats = getStats();
    console.log('\n=== Journal Statistics ===\n');
    console.log(`  Total events:     ${stats.total}`);
    console.log(`  Tasks:            ${stats.tasks}`);
    console.log(`  Completed:        ${stats.completed}`);
    console.log(`  Failed:          ${stats.failed}`);
    console.log(`  Success rate:    ${stats.success_rate}%`);
    console.log(`  First event:     ${stats.first_event || 'none'}`);
    console.log(`  Last event:      ${stats.last_event || 'none'}`);
    console.log('\n  Top event types:');
    const topTypes = Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [type, count] of topTypes) {
      console.log(`    ${type}: ${count}`);
    }
    console.log('\n  Top projects:');
    const topProjects = Object.entries(stats.by_project).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [proj, count] of topProjects) {
      console.log(`    ${proj}: ${count}`);
    }
    console.log();
    return;
  }
  
  console.log(`
Master Journal Auto Hook
========================

Usage:
  node journal-logger.js --log <type> --project <name> [--actor <name>] [--data <json>] [--risk <level>]
  node journal-logger.js --list
  node journal-logger.js --query [--project <name>] [--type <type>] [--limit N]
  node journal-logger.js --stats

Examples:
  node journal-logger.js --log task_completed --project "Dashboard" --actor "Agent"
  node journal-logger.js --log build_completed --project "Agent Core" --data "{\"version\":\"v2.0\"}"
  node journal-logger.js --query --project "Dashboard"
  node journal-logger.js --stats
`);
}

main();

module.exports = { logEvent, queryEvents, getStats, EVENT_TYPES };
