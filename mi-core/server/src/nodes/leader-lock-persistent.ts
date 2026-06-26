/**
 * Leader Lock (Persistent) — Phase 7
 * File-backed leader election for ALL Mi scheduled tasks.
 * Survives server restarts. Auto-failover on missed heartbeat.
 * Covers: briefing, graph-refresh, memory-sync, QA, monitoring, all cron tasks.
 */

import fs from 'fs';
import path from 'path';
import { setNodeRolePersistent, getNodePersistent } from './node-registry-persistent';

const GLOBAL_DIR = process.env.MI_CORE_ROOT
  ? path.join(process.env.MI_CORE_ROOT, '.local-agent-global')
  : 'D:/Project/Master/mi-core/.local-agent-global';
const NODES_DIR  = path.join(GLOBAL_DIR, 'nodes');
const LOCK_FILE  = path.join(NODES_DIR, 'leader.json');

const LOCK_TTL_MS      = 60 * 1000;   // 60s without heartbeat → failover candidate
const FAILOVER_DELAY   = 10 * 1000;   // wait 10s before claiming leadership
const THIS_NODE_ID     = process.env.MI_NODE_ID || 'mi-core-primary';

// ── Tasks guarded by leader lock ─────────────────────────────────────────────

export const LEADER_TASKS = [
  'daily_briefing',
  'graph_refresh',
  'memory_sync',
  'qa_regression',
  'log_analysis',
  'health_monitoring',
  'proactive_monitor',
  'knowledge_ingest',
  'cert_check',
  'cron_scheduler',
] as const;

export type LeaderTask = typeof LEADER_TASKS[number];

// ── Lock state ────────────────────────────────────────────────────────────────

export interface LeaderLockState {
  leader_node:     string | null;
  leader_name:     string | null;
  locked_at:       string | null;
  last_heartbeat:  string | null;
  failover_count:  number;
  history:         Array<{ node: string; acquired_at: string; released_at?: string; reason: string }>;
}

function ensureDir() {
  if (!fs.existsSync(NODES_DIR)) fs.mkdirSync(NODES_DIR, { recursive: true });
}

function loadLock(): LeaderLockState {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
  } catch {
    return { leader_node: null, leader_name: null, locked_at: null, last_heartbeat: null, failover_count: 0, history: [] };
  }
}

function saveLock(state: LeaderLockState) {
  ensureDir();
  fs.writeFileSync(LOCK_FILE, JSON.stringify(state, null, 2));
}

// ── Core API ──────────────────────────────────────────────────────────────────

export function getLockState(): LeaderLockState & { is_leader: boolean; ttl_remaining_ms: number; healthy: boolean } {
  const state = loadLock();
  const isLeader = state.leader_node === THIS_NODE_ID;
  const age = state.last_heartbeat ? Date.now() - new Date(state.last_heartbeat).getTime() : Infinity;
  const ttlRemaining = Math.max(0, LOCK_TTL_MS - age);
  const healthy = !!state.leader_node && age < LOCK_TTL_MS;
  return { ...state, is_leader: isLeader, ttl_remaining_ms: ttlRemaining, healthy };
}

export function acquireLeadership(nodeId = THIS_NODE_ID): { success: boolean; message: string } {
  const state = loadLock();
  const now = new Date().toISOString();

  // Already held by this node
  if (state.leader_node === nodeId) {
    state.last_heartbeat = now;
    saveLock(state);
    return { success: true, message: `${nodeId} renewed leadership` };
  }

  // Held by another node — check if stale
  if (state.leader_node && state.last_heartbeat) {
    const age = Date.now() - new Date(state.last_heartbeat).getTime();
    if (age < LOCK_TTL_MS) {
      return { success: false, message: `Leadership held by ${state.leader_node} — last heartbeat ${Math.floor(age/1000)}s ago` };
    }
    // Stale — do failover
    const staleDuration = Math.floor(age/1000);
    const staleNode = state.leader_node;
    console.log(`[LeaderLock] Failover: ${staleNode} missed heartbeat for ${staleDuration}s → ${nodeId} taking over`);
    state.history.push({ node: staleNode, acquired_at: state.locked_at || now, released_at: now, reason: 'heartbeat_timeout' });
    state.failover_count++;
    try { setNodeRolePersistent(staleNode, 'passive'); } catch { /* node may not exist in persistent registry */ }
    // Notify CEO via WhatsApp
    try {
      const { queueToCeo } = require('../services/whatsapp-sender');
      queueToCeo([
        `⚠️ *Leader Failover #${state.failover_count}*`,
        ``,
        `Node cũ: *${staleNode}* (miss heartbeat ${staleDuration}s)`,
        `Node mới: *${nodeId}*`,
        ``,
        `${LEADER_TASKS.length} scheduled tasks đã chuyển sang leader mới.`,
      ].join('\n'));
    } catch { /* WhatsApp sender may not be available */ }
  }

  // Free or stale — acquire
  const node = getNodePersistent(nodeId);
  state.leader_node    = nodeId;
  state.leader_name    = node?.node_name || nodeId;
  state.locked_at      = now;
  state.last_heartbeat = now;
  if (state.history.length > 20) state.history = state.history.slice(-20);
  saveLock(state);
  try { setNodeRolePersistent(nodeId, 'leader'); } catch { /* node may be registered later */ }
  console.log(`[LeaderLock] ${nodeId} acquired leadership`);
  return { success: true, message: `${nodeId} is now leader — guarding ${LEADER_TASKS.length} scheduled tasks` };
}

export function releaseLeadership(nodeId = THIS_NODE_ID): { success: boolean; message: string } {
  const state = loadLock();
  if (state.leader_node !== nodeId) {
    return { success: false, message: `${nodeId} does not hold leadership (current: ${state.leader_node || 'none'})` };
  }
  state.history.push({ node: nodeId, acquired_at: state.locked_at || new Date().toISOString(), released_at: new Date().toISOString(), reason: 'graceful_release' });
  state.leader_node    = null;
  state.leader_name    = null;
  state.locked_at      = null;
  state.last_heartbeat = null;
  saveLock(state);
  try { setNodeRolePersistent(nodeId, 'passive'); } catch { /* ok */ }
  console.log(`[LeaderLock] ${nodeId} released leadership`);
  return { success: true, message: `${nodeId} released leadership — tasks unguarded until next leader claims` };
}

export function leaderHeartbeatPersistent(nodeId = THIS_NODE_ID): boolean {
  const state = loadLock();
  if (state.leader_node !== nodeId) return false;
  state.last_heartbeat = new Date().toISOString();
  saveLock(state);
  return true;
}

/** Returns true only if THIS node is the current leader — use to gate scheduled tasks */
export function isLeader(nodeId = THIS_NODE_ID): boolean {
  const state = loadLock();
  if (state.leader_node !== nodeId) return false;
  if (!state.last_heartbeat) return false;
  const age = Date.now() - new Date(state.last_heartbeat).getTime();
  return age < LOCK_TTL_MS;
}

/** Boot-time: this node claims leadership if no active leader exists */
export function claimLeadershipOnBoot(nodeId = THIS_NODE_ID): void {
  const state = loadLock();
  if (state.leader_node && state.leader_node !== nodeId && state.last_heartbeat) {
    const age = Date.now() - new Date(state.last_heartbeat).getTime();
    if (age < LOCK_TTL_MS) {
      console.log(`[LeaderLock] Boot: existing leader ${state.leader_node} is healthy — joining as worker`);
      return;
    }
  }
  acquireLeadership(nodeId);
}

/** Start heartbeat interval — call once on boot if this node is/becomes leader */
export function startLeaderHeartbeat(intervalMs = 30_000): NodeJS.Timeout {
  const heartbeatTimer = setInterval(() => {
    if (!leaderHeartbeatPersistent()) {
      // Lost leadership — stop heartbeat and re-evaluate
      clearInterval(heartbeatTimer);
    }
  }, intervalMs);
  return heartbeatTimer;
}

export function getLeaderStatus(): string {
  const s = loadLock();
  const age = s.last_heartbeat ? Math.floor((Date.now() - new Date(s.last_heartbeat).getTime()) / 1000) : null;
  const icon = isLeader() ? '🟢' : s.leader_node ? '🟡' : '🔴';
  return [
    `${icon} *Mi Leader Lock*`,
    `👑 Leader: ${s.leader_node || 'NONE'}`,
    `⏱  Last heartbeat: ${age !== null ? `${age}s ago` : 'N/A'}`,
    `🔄 Failovers: ${s.failover_count}`,
    `🛡️  Guarded tasks: ${LEADER_TASKS.length}`,
  ].join('\n');
}
