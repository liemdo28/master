/**
 * Leader Lock — enforces single-active-writer for integration-system.
 * Only one node may be active writer at a time. Promotion requires CEO approval.
 * Heartbeat timeout triggers auto-failover if failover_auto=true.
 *
 * Dangerous actions (promote, demote, stop-active) are L3 — double approval.
 */

import { getNode, setNodeRole, getAllNodes } from './node-registry';
import { getActiveNode, registerProject } from './project-registry';

const PROJECT_ID = 'integration-system';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 min without heartbeat = auto-failover candidate

interface LockState {
  active_node: string | null;
  last_heartbeat: string | null;
  locked_at: string | null;
  failover_count: number;
}

let LOCK_STATE: LockState = {
  active_node: null,
  last_heartbeat: null,
  locked_at: null,
  failover_count: 0,
};

export function getLockState(): LockState & { project_id: string } {
  return { ...LOCK_STATE, project_id: PROJECT_ID };
}

export function acquireLock(nodeId: string): { success: boolean; message: string } {
  if (LOCK_STATE.active_node && LOCK_STATE.active_node !== nodeId) {
    return { success: false, message: `Lock held by ${LOCK_STATE.active_node}. Must demote first.` };
  }
  LOCK_STATE.active_node = nodeId;
  LOCK_STATE.locked_at = new Date().toISOString();
  LOCK_STATE.last_heartbeat = new Date().toISOString();
  setNodeRole(nodeId, 'active');
  registerProject(PROJECT_ID, nodeId, 'active');
  return { success: true, message: `${nodeId} is now ACTIVE for ${PROJECT_ID}` };
}

export function releaseLock(nodeId: string): { success: boolean; message: string } {
  if (LOCK_STATE.active_node !== nodeId) {
    return { success: false, message: `Node ${nodeId} does not hold the lock` };
  }
  LOCK_STATE.active_node = null;
  LOCK_STATE.locked_at = null;
  setNodeRole(nodeId, 'passive');
  registerProject(PROJECT_ID, nodeId, 'passive');
  return { success: true, message: `${nodeId} released lock — ${PROJECT_ID} has no active node` };
}

export function leaderHeartbeat(nodeId: string): boolean {
  if (LOCK_STATE.active_node !== nodeId) return false;
  LOCK_STATE.last_heartbeat = new Date().toISOString();
  return true;
}

export function checkLeaderHealth(): { healthy: boolean; message: string; auto_failover?: boolean } {
  if (!LOCK_STATE.active_node) return { healthy: true, message: 'No active node — integration-system not running' };
  if (!LOCK_STATE.last_heartbeat) return { healthy: false, message: 'Active node set but no heartbeat received' };
  const age = Date.now() - new Date(LOCK_STATE.last_heartbeat).getTime();
  if (age > LOCK_TTL_MS) {
    return {
      healthy: false,
      message: `Leader ${LOCK_STATE.active_node} missed heartbeat for ${Math.floor(age / 60000)}m`,
      auto_failover: true,
    };
  }
  return { healthy: true, message: `Leader ${LOCK_STATE.active_node} healthy — last seen ${Math.floor(age / 1000)}s ago` };
}

export function promoteNode(nodeId: string): { success: boolean; message: string } {
  const node = getNode(nodeId);
  if (!node) return { success: false, message: `Node ${nodeId} not found in registry` };
  if (LOCK_STATE.active_node && LOCK_STATE.active_node !== nodeId) {
    releaseLock(LOCK_STATE.active_node);
    LOCK_STATE.failover_count++;
  }
  return acquireLock(nodeId);
}

export function formatLockStatus(): string {
  const health = checkLeaderHealth();
  const icon = health.healthy ? '🟢' : '🔴';
  return [
    `${icon} *integration-system Leader Lock*`,
    `🔑 Active: ${LOCK_STATE.active_node || 'NONE'}`,
    `📡 Last heartbeat: ${LOCK_STATE.last_heartbeat || 'N/A'}`,
    `🔄 Failover count: ${LOCK_STATE.failover_count}`,
    `ℹ️ ${health.message}`,
  ].join('\n');
}
