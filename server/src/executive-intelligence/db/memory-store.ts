/**
 * Executive Memory Store — File-based persistence
 *
 * Stores memory items to disk as JSON files.
 * Supports keyword + tag-based search (no external vector DB needed).
 * Location: {GLOBAL_DIR}/executive-intelligence/memory/{namespace}.json
 *
 * When Postgres+pgvector is available, this store can be swapped out.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MemoryItem } from '../types';

// ── Configuration ─────────────────────────────────────────────────────────────

const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path.join(MI_CORE_ROOT, '.local-agent-global');
const MEMORY_DIR = path.join(GLOBAL_DIR, 'executive-intelligence', 'memory');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function generateId(): string {
  return `mem-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
}

function readNamespaceFile(namespace: string): MemoryItem[] {
  const filePath = path.join(MEMORY_DIR, `${namespace}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeNamespaceFile(namespace: string, items: MemoryItem[]): void {
  ensureDir(MEMORY_DIR);
  const filePath = path.join(MEMORY_DIR, `${namespace}.json`);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
}

function getAllNamespaces(): string[] {
  ensureDir(MEMORY_DIR);
  return fs.readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

// ── Tokenization for keyword search ───────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function computeRelevance(item: MemoryItem, queryTokens: string[]): number {
  const titleTokens = tokenize(item.title);
  const bodyTokens = tokenize(item.body || '');
  const tagTokens = (item.tags || []).map(t => t.toLowerCase());

  const allItemTokens = new Set([...titleTokens, ...bodyTokens, ...tagTokens]);

  let matches = 0;
  for (const qt of queryTokens) {
    for (const it of allItemTokens) {
      if (it.includes(qt) || qt.includes(it)) {
        matches++;
        break;
      }
    }
  }

  // Boost for title matches
  let titleBoost = 0;
  for (const qt of queryTokens) {
    if (titleTokens.some(t => t.includes(qt) || qt.includes(t))) {
      titleBoost += 0.3;
    }
  }

  return (matches / queryTokens.length) + titleBoost;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MemoryStore {
  /**
   * Store a memory item.
   */
  upsert(item: {
    namespace?: string;
    kind?: string;
    title: string;
    body?: string;
    tags?: string[];
    sourceRefs?: string[];
  }): MemoryItem;

  /**
   * Search memory items by keyword relevance.
   */
  search(query: string, options?: {
    namespace?: string;
    limit?: number;
    minRelevance?: number;
  }): Array<{ item: MemoryItem; relevance: number }>;

  /**
   * Get a specific memory item by ID.
   */
  getItem(id: string, namespace?: string): MemoryItem | null;

  /**
   * List all items in a namespace.
   */
  listItems(namespace: string, limit?: number): MemoryItem[];

  /**
   * Delete a memory item.
   */
  deleteItem(id: string, namespace: string): boolean;
}

// ── Implementation ────────────────────────────────────────────────────────────

export const memoryStore: MemoryStore = {
  upsert({ namespace = 'default', kind = 'general', title, body = '', tags = [], sourceRefs = [] }) {
    const items = readNamespaceFile(namespace);

    const item: MemoryItem = {
      id: generateId(),
      namespace,
      kind,
      title,
      body,
      tags,
      sourceRefs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    items.push(item);
    writeNamespaceFile(namespace, items);

    return item;
  },

  search(query, { namespace, limit = 10, minRelevance = 0.1 } = {}) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const namespaces = namespace ? [namespace] : getAllNamespaces();
    const results: Array<{ item: MemoryItem; relevance: number }> = [];

    for (const ns of namespaces) {
      const items = readNamespaceFile(ns);
      for (const item of items) {
        const relevance = computeRelevance(item, queryTokens);
        if (relevance >= minRelevance) {
          results.push({ item, relevance });
        }
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  },

  getItem(id, namespace) {
    if (namespace) {
      const items = readNamespaceFile(namespace);
      return items.find(i => i.id === id) || null;
    }
    // Search across all namespaces
    for (const ns of getAllNamespaces()) {
      const items = readNamespaceFile(ns);
      const found = items.find(i => i.id === id);
      if (found) return found;
    }
    return null;
  },

  listItems(namespace, limit = 50) {
    return readNamespaceFile(namespace).slice(-limit);
  },

  deleteItem(id, namespace) {
    const items = readNamespaceFile(namespace);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return false;

    items.splice(idx, 1);
    writeNamespaceFile(namespace, items);
    return true;
  },
};
