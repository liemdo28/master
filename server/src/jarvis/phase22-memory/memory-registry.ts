/**
 * Phase 22 — Memory Universe
 * Multi-layer persistent memory: personal, operational, decision, project, store.
 */

import fs from 'fs';
import path from 'path';

export type MemoryLayer = 'personal' | 'operational' | 'decision' | 'relationship' | 'project' | 'store';

export interface MemoryEntry {
  id: string;
  layer: MemoryLayer;
  subject: string;
  content: string;
  tags: string[];
  confidence: number;   // 0-1
  source: string;       // 'whatsapp' | 'auto' | 'manual'
  created_at: string;
  updated_at: string;
  recalled_count: number;
  last_recalled?: string;
}

export interface MemoryQuery {
  q: string;
  layer?: MemoryLayer;
  limit?: number;
  since?: string;
}

const MEM_PATH = path.join(process.env.APPDATA || 'C:/Users/liemdo/AppData/Roaming', '../Local/mi-core/memory-registry.json');

let MEMORIES: MemoryEntry[] = [];

function load() {
  try { if (fs.existsSync(MEM_PATH)) MEMORIES = JSON.parse(fs.readFileSync(MEM_PATH, 'utf-8')); } catch { MEMORIES = []; }
}

function save() {
  try {
    const dir = path.dirname(MEM_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEM_PATH, JSON.stringify(MEMORIES, null, 2));
  } catch { /* non-critical */ }
}

export function storeMemory(entry: Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at' | 'recalled_count'>): MemoryEntry {
  // Check for existing memory on same subject+layer
  const existing = MEMORIES.find(m => m.layer === entry.layer && m.subject.toLowerCase() === entry.subject.toLowerCase());
  if (existing) {
    existing.content = entry.content;
    existing.tags = entry.tags;
    existing.updated_at = new Date().toISOString();
    existing.confidence = entry.confidence;
    save();
    return existing;
  }
  const mem: MemoryEntry = {
    ...entry,
    id: 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    recalled_count: 0,
  };
  MEMORIES.push(mem);
  if (MEMORIES.length > 10000) MEMORIES.splice(0, MEMORIES.length - 10000);
  save();
  return mem;
}

export function recallMemory(query: MemoryQuery): MemoryEntry[] {
  const terms = query.q.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const since = query.since ? new Date(query.since).getTime() : 0;
  const limit = query.limit || 10;

  let pool = MEMORIES;
  if (query.layer) pool = pool.filter(m => m.layer === query.layer);
  if (since) pool = pool.filter(m => new Date(m.created_at).getTime() >= since);

  const scored = pool.map(m => {
    let score = 0;
    for (const term of terms) {
      if (m.subject.toLowerCase().includes(term)) score += 3;
      if (m.content.toLowerCase().includes(term)) score += 2;
      if (m.tags.some(t => t.toLowerCase().includes(term))) score += 1;
    }
    return { m, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

  const results = scored.slice(0, limit).map(r => r.m);

  // Update recall stats
  for (const mem of results) {
    mem.recalled_count++;
    mem.last_recalled = new Date().toISOString();
  }
  if (results.length) save();

  return results;
}

export function getMemoryTimeline(layer?: MemoryLayer, limit = 20): MemoryEntry[] {
  let pool = layer ? MEMORIES.filter(m => m.layer === layer) : MEMORIES;
  return pool.slice(-limit).reverse();
}

export function getMemoryStats() {
  const byLayer: Record<string, number> = {};
  for (const m of MEMORIES) byLayer[m.layer] = (byLayer[m.layer] || 0) + 1;
  return { total: MEMORIES.length, by_layer: byLayer, oldest: MEMORIES[0]?.created_at, newest: MEMORIES[MEMORIES.length - 1]?.created_at };
}

export function deleteMemory(id: string): boolean {
  const idx = MEMORIES.findIndex(m => m.id === id);
  if (idx < 0) return false;
  MEMORIES.splice(idx, 1);
  save();
  return true;
}

export function formatMemoryForWhatsApp(memories: MemoryEntry[]): string {
  if (!memories.length) return 'Em không tìm thấy ký ức nào liên quan.';
  const lines = memories.slice(0, 5).map(m => {
    const age = Math.round((Date.now() - new Date(m.created_at).getTime()) / 86400000);
    return `📝 *${m.subject}* (${m.layer}, ${age}d ago)\n   ${m.content.slice(0, 100)}`;
  });
  return `🧠 *Memory Recall*\n\n${lines.join('\n\n')}`;
}

// Auto-seed some operational memories on startup
function seedDefaults() {
  if (MEMORIES.length > 0) return;
  const seeds: Array<Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at' | 'recalled_count'>> = [
    { layer: 'personal', subject: 'CEO Profile', content: 'Liêm Đỗ — Founder/CEO. iPhone + WhatsApp as primary interface. Based in San Antonio TX.', tags: ['ceo', 'profile'], confidence: 1, source: 'manual' },
    { layer: 'store', subject: 'Stone Oak', content: 'Bakudan Ramen Stone Oak — San Antonio TX. One of 5 stores.', tags: ['store', 'san antonio', 'stone oak'], confidence: 1, source: 'manual' },
    { layer: 'project', subject: 'Mi-Core', content: 'Mi-Core is the CEO OS — port 4001, TypeScript, runs on PC.', tags: ['mi-core', 'project', 'server'], confidence: 1, source: 'manual' },
    { layer: 'operational', subject: 'Integration System', content: 'Laptop1 runs the integration system + WhatsApp AI Gateway (port 3211).', tags: ['laptop1', 'integration', 'gateway'], confidence: 1, source: 'manual' },
  ];
  for (const s of seeds) storeMemory(s);
}

load();
seedDefaults();
