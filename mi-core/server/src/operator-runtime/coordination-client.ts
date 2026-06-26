import { getStoredTask } from './task-store';
import { CoordinationCheckResult } from './types';

export class CoordinationClient {
  async verifyTask(taskId: string, objectiveId: string): Promise<CoordinationCheckResult> {
    try {
      const existing = getStoredTask(taskId);
      if (existing) {
        return { exists: true, source: 'mock', available: false, details: { taskId, objectiveId, note: 'Found in local operator store' } };
      }
      return { exists: true, source: 'mock', available: false, details: { taskId, objectiveId, note: 'Coordination API unavailable; mock compatibility adapter used' } };
    } catch {
      return { exists: true, source: 'mock', available: false, details: { taskId, objectiveId, note: 'Mock compatibility adapter fallback' } };
    }
  }

  async updateStatus(taskId: string, status: string): Promise<{ available: boolean; status: string }> {
    return { available: false, status: `${taskId}:${status}` };
  }

  async registerEvidence(taskId: string, evidence: string[]): Promise<{ available: boolean; taskId: string; evidence: string[] }> {
    return { available: false, taskId, evidence };
  }
}

export const coordinationClient = new CoordinationClient();
