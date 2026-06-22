/**
 * DecisionMemory.mjs
 * Logs and retrieves past CEO decisions and outcomes.
 * Used by Mi to avoid re-asking and to show context.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR      = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const DECISIONS_PATH  = path.join(GLOBAL_DIR, 'executive-memory-v2', 'decision_memory.json');

export class DecisionMemory {
  static getAll() {
    try { return JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf-8')); }
    catch { return { decisions: [] }; }
  }

  static getDecisions() {
    return this.getAll().decisions || [];
  }

  static addDecision(decision) {
    const data = this.getAll();
    data.decisions = data.decisions || [];
    data.decisions.unshift({
      id: `dec_${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      ...decision,
    });
    data.decisions = data.decisions.slice(0, 200); // keep last 200
    fs.mkdirSync(path.dirname(DECISIONS_PATH), { recursive: true });
    fs.writeFileSync(DECISIONS_PATH, JSON.stringify(data, null, 2));
  }

  static search(query) {
    const q = query.toLowerCase();
    return this.getDecisions().filter(d =>
      d.topic?.toLowerCase().includes(q) || d.decision?.toLowerCase().includes(q)
    ).slice(0, 5);
  }

  static getRecent(limit = 5) {
    return this.getDecisions().slice(0, limit);
  }
}
