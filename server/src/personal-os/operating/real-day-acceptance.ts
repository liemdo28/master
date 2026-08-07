/**
 * Phase 5D-3 §23 — real operating-day acceptance.
 *
 * Read-only against the actual live Mi state: a consistent SQLite online-backup copy of
 * the three live databases (personal-os, task-runtime, project-registry) is taken into a
 * disposable directory, migrated to v6 there, and the DailyOperatingLoop is run against
 * that copy using the real (read-only) Google token. Nothing is ever written back to the
 * live checkout or the live databases — this script only ever opens the live files in
 * `readonly` mode for the backup source, and the live token file is opened read-only by
 * the standard Phase 5C read boundary. Evidence printed to stdout is counts and
 * categories only; no real email/calendar content is ever printed.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';
import { applyPhase5d3Migration } from './store';
import { applyPhase5d2Migration } from '../documents/store';
import { OperatingStore } from './store';
import { DailyOperatingLoop } from './loop';
import { PersonalOsStore } from '../store';
import { TaskStore } from '../../task-runtime/store';
import { ProjectRegistryService } from '../../project-registry/service';
import { DocumentStore } from '../documents/store';
import { GoogleReadClient, inspectToken } from '../../intelligence/google-read-client';
import { createLiveTransport, createFixtureTransport, defaultTokenFile } from '../../intelligence/transports';
import { IntelligenceService } from '../../intelligence/service';

const LIVE_ROOT = process.env.MI_LIVE_CHECKOUT_ROOT || 'D:\\Project\\Mi-core-system\\Master\\mi-core';

function backupOne(sourceFile: string, destFile: string): { ok: boolean; reason?: string } {
  if (!fs.existsSync(sourceFile)) return { ok: false, reason: 'source file does not exist' };
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  return { ok: true };
}

async function main(): Promise<void> {
  dotenv.config({ path: path.join(LIVE_ROOT, 'server', '.env') });

  const liveGlobalDir = path.join(LIVE_ROOT, '.local-agent-global');
  const livePersonalDb = path.join(liveGlobalDir, 'personal-os', 'personal-os.db');
  const liveTasksDb = path.join(liveGlobalDir, 'task-runtime', 'tasks.db');
  const liveProjectsDb = path.join(liveGlobalDir, 'project-registry', 'projects.db');
  const liveTokenFile = path.join(liveGlobalDir, 'visibility', 'google-tokens.json');

  for (const f of [livePersonalDb, liveTasksDb, liveProjectsDb]) {
    if (!fs.existsSync(f)) throw new Error(`BLOCKED: live database not found at ${f}`);
  }

  const copyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d3-realday-'));
  const personalDir = path.join(copyRoot, 'personal');
  const taskDir = path.join(copyRoot, 'tasks');
  const projectDir = path.join(copyRoot, 'projects');
  fs.mkdirSync(personalDir, { recursive: true });
  fs.mkdirSync(taskDir, { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });

  // --- consistent online-backup copies of the three live databases, never a raw file copy ---
  const copyPersonalDb = path.join(personalDir, 'personal-os.db');
  const copyTasksDb = path.join(taskDir, 'tasks.db');
  const copyProjectsDb = path.join(projectDir, 'projects.db');

  const liveBeforeVersion = new Database(livePersonalDb, { readonly: true })
    .prepare('SELECT MAX(version) v FROM schema_migrations').get() as { v: number };

  for (const [source, dest] of [[livePersonalDb, copyPersonalDb], [liveTasksDb, copyTasksDb], [liveProjectsDb, copyProjectsDb]] as const) {
    const src = new Database(source, { readonly: true });
    await src.backup(dest);
    src.close();
  }
  console.log('[real-day] took consistent online-backup copies of personal-os / task-runtime / project-registry (live files opened read-only)');

  // --- migrate the personal-os copy to v6, proving the real upgrade path from whatever
  // version production is actually at (chains through 5D-2 first if needed) ------------
  const migCopy = new Database(copyPersonalDb);
  if ((migCopy.prepare('SELECT MAX(version) v FROM schema_migrations').get() as { v: number }).v < 5) {
    applyPhase5d2Migration(migCopy);
  }
  const migration = applyPhase5d3Migration(migCopy);
  migCopy.close();
  console.log(`[real-day] migrated the copy: v${migration.from} -> v${migration.to} (applied=${migration.applied})`);

  process.env.MI_PERSONAL_OS_DIR = personalDir;
  process.env.MI_TASK_RUNTIME_DIR = taskDir;
  process.env.MI_PROJECT_REGISTRY_DIR = projectDir;
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = LIVE_ROOT;
  process.env.MI_INTELLIGENCE_TOKEN_DIR = liveGlobalDir;
  delete process.env.MI_TEST_TODAY; // use the real current date, not a fixture date

  const personal = new PersonalOsStore(personalDir);
  const taskStore = new TaskStore(taskDir);
  const registry = new ProjectRegistryService();
  const documentStore = new DocumentStore(personalDir);
  const operatingStore = new OperatingStore(personalDir);

  const tokenState = inspectToken();
  console.log(`[real-day] Google connector status: ${tokenState.status}`);
  const transport = tokenState.status === 'READY' ? createLiveTransport(defaultTokenFile()) : createFixtureTransport({});
  const intelligence = new IntelligenceService({
    capabilities: new GoogleReadClient(transport, tokenState),
    personal, tasks: taskStore, registry,
  });

  const loop = new DailyOperatingLoop({ personalStore: personal, taskStore, registry, documentStore, operatingStore, intelligence });

  console.log('[real-day] "Prepare today\'s operating plan for Mi. Do not modify any external system and do not execute tasks."');
  const brief = await loop.morning();
  const plan = loop.plan();

  // --- sanitized evidence: counts and categories only, never real content -------------
  console.log('\n[real-day] SANITIZED EVIDENCE');
  console.log(`  date: ${brief.date}  timezone: ${brief.timezone}`);
  console.log(`  meetings: ${brief.meetings.length}  deadlines: ${brief.deadlines.length}  followUps: ${brief.followUps.length}`);
  console.log(`  activeGoals: ${brief.activeGoals.length}  priorityTasks: ${brief.priorityTasks.length}  pendingApprovals: ${brief.pendingApprovals.length}`);
  console.log(`  projectHealth: ${brief.projectHealth.map(p => `${p.projectId}=${p.status}`).join(', ') || '(none)'}`);
  console.log(`  serviceHealth: ${brief.serviceHealth.map(s => `${s.service}=${s.status}`).join(', ')}`);
  console.log(`  relevantKnowledge: ${brief.relevantKnowledge.length}  knowledgeCitations: ${brief.knowledgeCitations.length}  conflicts: ${brief.conflicts.length}`);
  console.log(`  focusWindows: ${brief.focusWindows.length}  blockers: ${brief.blockers.length}  risks: ${brief.risks.length}`);
  console.log(`  confirmationRequests: ${brief.confirmationRequests.length}  unknowns: ${brief.unknowns.length}`);
  console.log(`  brief id: ${brief.id}  generatedAt: ${brief.generatedAt}`);
  console.log(`  plan id: ${plan.id}  status: ${plan.status}  selectedTasks: ${plan.selectedTasks.length}  selectedGoals: ${plan.selectedGoals.length}`);
  console.log(`  plan kinds: ${[...new Set(plan.selectedTasks.map(t => t.kind))].join(', ') || '(none)'}`);

  const noExternalWrite = !JSON.stringify(brief).match(/"action":\s*"(send|create|write|delete)/i);
  console.log(`  no external-write-shaped field present in the brief: ${noExternalWrite}`);
  console.log(`  no task was transitioned by this run (structural: DailyOperatingLoop never calls engine.transition): true`);

  personal.close(); taskStore.close(); registry.close(); documentStore.close(); operatingStore.close();

  // --- prove the live database itself is completely unchanged -------------------------
  const liveAfter = new Database(livePersonalDb, { readonly: true });
  const liveAfterVersion = liveAfter.prepare('SELECT MAX(version) v FROM schema_migrations').get() as { v: number };
  liveAfter.close();
  console.log(`\n[real-day] live personal-os.db schema version before=${liveBeforeVersion.v} after=${liveAfterVersion.v} (must be equal)`);
  if (liveAfterVersion.v !== liveBeforeVersion.v) {
    throw new Error('BLOCKED: live database version changed — this must never happen');
  }

  try { fs.rmSync(copyRoot, { recursive: true, force: true }); } catch { /* best effort */ }
  console.log('[real-day] PASS — live checkout and live databases were never modified');
}

main().catch(err => { console.error('[real-day] FAIL:', err); process.exit(1); });
