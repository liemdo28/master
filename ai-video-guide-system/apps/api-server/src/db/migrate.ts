import { getDb, closeDb } from "./database.js";
import { config } from "../config.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const migrations = [
  `CREATE TABLE IF NOT EXISTS video_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT \x27draft\x27,
    target_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime(\x27now\x27)),
    updated_at TEXT NOT NULL DEFAULT (datetime(\x27now\x27)),
    metadata TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    description TEXT NOT NULL,
    action_type TEXT NOT NULL DEFAULT \x27click\x27,
    selector TEXT,
    selector_type TEXT DEFAULT \x27css\x27,
    value TEXT,
    delay_ms INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT \x27pending\x27,
    screenshot_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime(\x27now\x27)),
    FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT \x27screenshot\x27,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime(\x27now\x27)),
    FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT \x27pending\x27,
    video_path TEXT,
    thumbnail_path TEXT,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime(\x27now\x27)),
    FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS selector_registry (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    selector TEXT NOT NULL,
    selector_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TEXT NOT NULL DEFAULT (datetime(\x27now\x27)),
    FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_steps_project ON steps(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_step ON captures(step_id)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_project ON captures(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_render_jobs_project ON render_jobs(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_selector_project ON selector_registry(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_selector_active ON selector_registry(active)`,
];

async function runMigrations() {
  console.log(`Running migrations on database: ${config.databaseUrl}`);
  const db = getDb();
  for (const sql of migrations) {
    db.exec(sql);
  }
  closeDb();
  console.log("Migrations completed successfully.");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});