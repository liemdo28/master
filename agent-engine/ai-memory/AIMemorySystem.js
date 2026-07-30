/**
 * AI Memory System
 * Semantic memory, project history, task memory, previous prompts, previous fixes
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const MEMORY_DIR = '/Users/liemdo/.super-agent-ai/memory';

export class AIMemorySystem {
  constructor() {
    this.semantic = new Map();
    this.projectHistory = new Map();
    this.taskMemory = [];
    this.previousPrompts = [];
    this.previousFixes = [];
    this._loadAll();
  }

  // ── Semantic Memory ──────────────────────────────────────────────────────────
  store(key, value, metadata = {}) {
    const entry = {
      key,
      value,
      metadata,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    };
    this.semantic.set(key, entry);
    this._saveSemantic();
  }

  retrieve(key) {
    const entry = this.semantic.get(key);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this._saveSemantic();
    }
    return entry?.value ?? null;
  }

  search(query, limit = 10) {
    const q = query.toLowerCase();
    const results = [];
    for (const [key, entry] of this.semantic) {
      const score = this._relevanceScore(key, entry.value, q);
      if (score > 0) {
        results.push({ key, ...entry, score });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  _relevanceScore(key, value, query) {
    const k = key.toLowerCase();
    const v = String(value).toLowerCase();
    let score = 0;
    if (k.includes(query)) score += 10;
    if (v.includes(query)) score += 5;
    const words = query.split(' ');
    for (const w of words) {
      if (k.includes(w)) score += 3;
      if (v.includes(w)) score += 1;
    }
    return score;
  }

  // ── Project History ──────────────────────────────────────────────────────────
  recordProjectAccess(projectPath, context = {}) {
    const entry = {
      projectPath,
      name: basename(projectPath),
      timestamp: Date.now(),
      accessCount: 1,
      lastContext: context,
    };
    const existing = this.projectHistory.get(projectPath);
    if (existing) {
      existing.timestamp = Date.now();
      existing.accessCount++;
      existing.lastContext = context;
    } else {
      this.projectHistory.set(projectPath, entry);
    }
    this._saveProjectHistory();
  }

  getRecentProjects(limit = 10) {
    const entries = [...this.projectHistory.values()];
    return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  getProjectPatterns(projectPath) {
    const patterns = [];
    for (const [key, entry] of this.semantic) {
      if (entry.metadata?.projectPath === projectPath) {
        patterns.push({ key, ...entry });
      }
    }
    return patterns;
  }

  // ── Task Memory ─────────────────────────────────────────────────────────────
  storeTask(task) {
    const entry = {
      id: `task_${Date.now()}`,
      task,
      timestamp: Date.now(),
      status: 'pending',
    };
    this.taskMemory.unshift(entry);
    if (this.taskMemory.length > 100) this.taskMemory = this.taskMemory.slice(0, 100);
    this._saveTaskMemory();
    return entry.id;
  }

  updateTask(taskId, updates) {
    const task = this.taskMemory.find(t => t.id === taskId);
    if (task) Object.assign(task, updates);
    this._saveTaskMemory();
  }

  getRecentTasks(limit = 20) {
    return this.taskMemory.slice(0, limit);
  }

  // ── Previous Prompts ────────────────────────────────────────────────────────
  storePrompt(prompt, response = null, metadata = {}) {
    const entry = {
      id: `prompt_${Date.now()}`,
      prompt,
      response,
      metadata,
      timestamp: Date.now(),
    };
    this.previousPrompts.unshift(entry);
    if (this.previousPrompts.length > 200) this.previousPrompts = this.previousPrompts.slice(0, 200);
    this._savePreviousPrompts();
    return entry.id;
  }

  getSimilarPrompts(query, limit = 5) {
    const q = query.toLowerCase();
    return this.previousPrompts
      .filter(p => p.prompt.toLowerCase().includes(q))
      .slice(0, limit);
  }

  getRecentPrompts(limit = 20) {
    return this.previousPrompts.slice(0, limit);
  }

  // ── Previous Fixes ─────────────────────────────────────────────────────────
  storeFix(issue, fix, context = {}) {
    const entry = {
      id: `fix_${Date.now()}`,
      issue,
      fix,
      context,
      timestamp: Date.now(),
      successCount: 1,
    };
    this.previousFixes.unshift(entry);
    if (this.previousFixes.length > 100) this.previousFixes = this.previousFixes.slice(0, 100);
    this._savePreviousFixes();
    return entry.id;
  }

  markFixSuccess(fixId) {
    const fix = this.previousFixes.find(f => f.id === fixId);
    if (fix) fix.successCount++;
    this._savePreviousFixes();
  }

  findSimilarFix(issue) {
    const q = issue.toLowerCase();
    return this.previousFixes
      .filter(f => f.issue.toLowerCase().includes(q))
      .sort((a, b) => b.successCount - a.successCount);
  }

  // ── Context Building ────────────────────────────────────────────────────────
  buildContext(prompt, projectPath = null) {
    const relevantPrompts = this.getSimilarPrompts(prompt, 3);
    const relevantFixes = projectPath
      ? this.findSimilarFix(prompt).filter(f => f.context?.projectPath === projectPath)
      : this.findSimilarFix(prompt).slice(0, 3);
    const recentProjects = this.getRecentProjects(3);
    const memoryEntries = this.search(prompt, 5);

    return {
      prompt,
      projectPath,
      relevantPrompts: relevantPrompts.map(p => ({ prompt: p.prompt, timestamp: p.timestamp })),
      similarFixes: relevantFixes.map(f => ({ issue: f.issue, fix: f.fix, successCount: f.successCount })),
      recentProjects: recentProjects.map(p => ({ name: p.name, path: p.projectPath, timestamp: p.timestamp })),
      semanticMatches: memoryEntries.map(m => ({ key: m.key, value: m.value, score: m.score })),
    };
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  _ensureDir() {
    try {
      mkdirSync(MEMORY_DIR, { recursive: true });
    } catch {}
  }

  _loadAll() {
    this._loadSemantic();
    this._loadProjectHistory();
    this._loadTaskMemory();
    this._loadPreviousPrompts();
    this._loadPreviousFixes();
  }

  _loadSemantic() {
    try {
      const p = join(MEMORY_DIR, 'semantic.json');
      if (existsSync(p)) {
        const data = JSON.parse(readFileSync(p, 'utf8'));
        this.semantic = new Map(Object.entries(data));
      }
    } catch {}
  }

  _saveSemantic() {
    try {
      this._ensureDir();
      const data = Object.fromEntries(this.semantic);
      writeFileSync(join(MEMORY_DIR, 'semantic.json'), JSON.stringify(data, null, 2));
    } catch {}
  }

  _loadProjectHistory() {
    try {
      const p = join(MEMORY_DIR, 'project-history.json');
      if (existsSync(p)) {
        const data = JSON.parse(readFileSync(p, 'utf8'));
        this.projectHistory = new Map(Object.entries(data));
      }
    } catch {}
  }

  _saveProjectHistory() {
    try {
      this._ensureDir();
      const data = Object.fromEntries(this.projectHistory);
      writeFileSync(join(MEMORY_DIR, 'project-history.json'), JSON.stringify(data, null, 2));
    } catch {}
  }

  _loadTaskMemory() {
    try {
      const p = join(MEMORY_DIR, 'task-memory.json');
      if (existsSync(p)) this.taskMemory = JSON.parse(readFileSync(p, 'utf8'));
    } catch {}
  }

  _saveTaskMemory() {
    try {
      this._ensureDir();
      writeFileSync(join(MEMORY_DIR, 'task-memory.json'), JSON.stringify(this.taskMemory, null, 2));
    } catch {}
  }

  _loadPreviousPrompts() {
    try {
      const p = join(MEMORY_DIR, 'previous-prompts.json');
      if (existsSync(p)) this.previousPrompts = JSON.parse(readFileSync(p, 'utf8'));
    } catch {}
  }

  _savePreviousPrompts() {
    try {
      this._ensureDir();
      writeFileSync(join(MEMORY_DIR, 'previous-prompts.json'), JSON.stringify(this.previousPrompts, null, 2));
    } catch {}
  }

  _loadPreviousFixes() {
    try {
      const p = join(MEMORY_DIR, 'previous-fixes.json');
      if (existsSync(p)) this.previousFixes = JSON.parse(readFileSync(p, 'utf8'));
    } catch {}
  }

  _savePreviousFixes() {
    try {
      this._ensureDir();
      writeFileSync(join(MEMORY_DIR, 'previous-fixes.json'), JSON.stringify(this.previousFixes, null, 2));
    } catch {}
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  getStats() {
    return {
      semanticCount: this.semantic.size,
      projectHistoryCount: this.projectHistory.size,
      taskMemoryCount: this.taskMemory.length,
      previousPromptsCount: this.previousPrompts.length,
      previousFixesCount: this.previousFixes.length,
    };
  }
}

export const aiMemorySystem = new AIMemorySystem();
export default AIMemorySystem;