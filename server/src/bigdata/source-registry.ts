/**
 * Source Registry — register and manage data sources.
 */

import { pgQuery, pgQueryOne } from './db-client';
import { auditLog } from './audit-service';

export interface DataSource {
  id: number;
  name: string;
  type: string;
  system: string;
  connection_type: string;
  status: string;
  owner: string;
  description: string;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function listSources(): Promise<DataSource[]> {
  return pgQuery<DataSource>('SELECT * FROM data_sources ORDER BY name');
}

export async function getSource(id: number): Promise<DataSource | null> {
  return pgQueryOne<DataSource>('SELECT * FROM data_sources WHERE id = $1', [id]);
}

export async function getSourceByName(name: string): Promise<DataSource | null> {
  return pgQueryOne<DataSource>('SELECT * FROM data_sources WHERE name = $1', [name]);
}

export async function registerSource(params: {
  name: string;
  type: string;
  system?: string;
  connection_type?: string;
  owner?: string;
  description?: string;
  config_json?: Record<string, unknown>;
}): Promise<DataSource> {
  const { name, type, system = '', connection_type = 'push', owner = 'system', description = '', config_json = {} } = params;

  const existing = await getSourceByName(name);
  if (existing) return existing;

  const rows = await pgQuery<DataSource>(
    `INSERT INTO data_sources (name, type, system, connection_type, owner, description, config_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [name, type, system, connection_type, owner, description, JSON.stringify(config_json)]
  );
  const source = rows[0];
  await auditLog({ actor: 'system', action: 'register_source', entity_type: 'data_source', entity_id: String(source.id), after_json: source as unknown as Record<string, unknown> });
  return source;
}

export async function updateSourceStatus(id: number, status: string): Promise<void> {
  await pgQuery(
    `UPDATE data_sources SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
}
