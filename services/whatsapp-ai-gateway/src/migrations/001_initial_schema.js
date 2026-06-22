'use strict';

// Initial migration — ensures base tables exist without breaking existing installs.
// Uses IF NOT EXISTS so it is safe to run even when tables were created before migrations.

async function up(db, run) {
  await run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok',
    error TEXT
  )`);
}

module.exports = { up };
