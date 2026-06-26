/**
 * Graph Database — Phase 14
 * SQLite-backed entity + relationship store for the Ownership/Dependency Graph.
 * Uses better-sqlite3 (same as knowledge-db).
 *
 * Schema:
 *   entities   — nodes (project, service, repo, store, owner, team)
 *   edges      — directed relationships (owner_of, depends_on, contains, supports, responsible_for)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const GRAPH_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/graph');
const GRAPH_DB = path.join(GRAPH_DIR, 'graph.db');

// ── Types ──────────────────────────────────────────────────────────────────────

export type EntityType =
  | 'project'
  | 'service'
  | 'repository'
  | 'store'
  | 'owner'
  | 'team'
  | 'file'
  | 'class'
  | 'function'
  | 'api'
  | 'dependency'
  | 'health_source'
  | 'health_metric'
  | 'health_trend';

export type RelationshipType =
  | 'owner_of'          // owner/team → project/service
  | 'depends_on'        // project/service → project/service
  | 'contains'          // project → service/repo
  | 'supports'          // service → project (infra layer)
  | 'responsible_for'   // owner/team → store/repo
  | 'deploys_to'        // project → service
  | 'exposes_api'       // service → service
  | 'monitors'          // service → project
  | 'declares'          // file → class/function/api
  | 'imports'           // file → dependency/file
  | 'affects'           // file/api/service → project/domain
  | 'tested_by'         // file/project → test file
  | 'provides'          // source → metric
  | 'influences'        // health/code metric → recommendation/domain
  | 'contributes_to'    // metric/function/file → trend/project
  | 'derived_from';     // normalized adapter data → source data

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Edge {
  id: string;
  from_id: string;
  to_id: string;
  relationship: RelationshipType;
  weight: number;           // 1-10: criticality of dependency
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── DB Init ────────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getGraphDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(GRAPH_DIR, { recursive: true });
  _db = new Database(GRAPH_DB);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      description TEXT DEFAULT '',
      metadata    TEXT DEFAULT '{}',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS edges (
      id           TEXT PRIMARY KEY,
      from_id      TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      to_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      relationship TEXT NOT NULL,
      weight       INTEGER DEFAULT 5,
      metadata     TEXT DEFAULT '{}',
      created_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(from_id, to_id, relationship)
    );

    CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
    CREATE INDEX IF NOT EXISTS idx_edges_to   ON edges(to_id);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
  `);
}

// ── Entity CRUD ────────────────────────────────────────────────────────────────

export function upsertEntity(e: Omit<Entity, 'created_at' | 'updated_at'>): void {
  const db = getGraphDb();
  db.prepare(`
    INSERT INTO entities (id, name, type, description, metadata)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      description = excluded.description,
      metadata = excluded.metadata,
      updated_at = datetime('now')
  `).run(e.id, e.name, e.type, e.description, JSON.stringify(e.metadata));
}

export function getEntity(id: string): Entity | null {
  const row = getGraphDb().prepare('SELECT * FROM entities WHERE id = ?').get(id) as any;
  if (!row) return null;
  return { ...row, metadata: JSON.parse(row.metadata || '{}') };
}

export function findEntities(type?: EntityType, nameQuery?: string): Entity[] {
  let sql = 'SELECT * FROM entities WHERE 1=1';
  const params: unknown[] = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (nameQuery) { sql += ' AND name LIKE ?'; params.push(`%${nameQuery}%`); }
  sql += ' ORDER BY name';
  return (getGraphDb().prepare(sql).all(...params) as any[]).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
}

export function getAllEntities(): Entity[] {
  return (getGraphDb().prepare('SELECT * FROM entities ORDER BY type, name').all() as any[])
    .map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
}

// ── Edge CRUD ──────────────────────────────────────────────────────────────────

export function upsertEdge(e: Omit<Edge, 'id' | 'created_at'>): void {
  const db = getGraphDb();
  const id = `${e.from_id}__${e.relationship}__${e.to_id}`;
  db.prepare(`
    INSERT INTO edges (id, from_id, to_id, relationship, weight, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(from_id, to_id, relationship) DO UPDATE SET
      weight = excluded.weight,
      metadata = excluded.metadata
  `).run(id, e.from_id, e.to_id, e.relationship, e.weight, JSON.stringify(e.metadata));
}

export function getOutEdges(entityId: string, relationship?: RelationshipType): Edge[] {
  let sql = 'SELECT * FROM edges WHERE from_id = ?';
  const params: unknown[] = [entityId];
  if (relationship) { sql += ' AND relationship = ?'; params.push(relationship); }
  return (getGraphDb().prepare(sql).all(...params) as any[]).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
}

export function getInEdges(entityId: string, relationship?: RelationshipType): Edge[] {
  let sql = 'SELECT * FROM edges WHERE to_id = ?';
  const params: unknown[] = [entityId];
  if (relationship) { sql += ' AND relationship = ?'; params.push(relationship); }
  return (getGraphDb().prepare(sql).all(...params) as any[]).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
}

export function getAllEdges(): Edge[] {
  return (getGraphDb().prepare('SELECT * FROM edges').all() as any[]).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
}

export function getGraphStats() {
  const db = getGraphDb();
  const entityCount = (db.prepare('SELECT COUNT(*) as c FROM entities').get() as any).c;
  const edgeCount = (db.prepare('SELECT COUNT(*) as c FROM edges').get() as any).c;
  const typeBreakdown = db.prepare('SELECT type, COUNT(*) as c FROM entities GROUP BY type').all() as any[];
  const relBreakdown = db.prepare('SELECT relationship, COUNT(*) as c FROM edges GROUP BY relationship').all() as any[];
  return { entity_count: entityCount, edge_count: edgeCount, types: typeBreakdown, relationships: relBreakdown };
}
