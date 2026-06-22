/**
 * QB Connector Reset Script
 * Run on LIEMDO-PC with QuickBooks Desktop open.
 * node scripts/reset-qb-connector.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require   = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.resolve(__dirname, '../data/qb-agent.db');

const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

console.log('\n🔧 QB Connector Reset\n');

const before = db.prepare('SELECT * FROM dd_machine_state').get();
console.log('Before:', before);

db.prepare(`
  UPDATE dd_machine_state
  SET last_sync_status = 'pending',
      last_error       = NULL,
      last_sync_at     = NULL
  WHERE machine_id = 'laptop-01'
`).run();

const after = db.prepare('SELECT * FROM dd_machine_state').get();
console.log('After:', after);
db.close();

console.log('\n✅ Reset complete.');
console.log('   Next steps:');
console.log('   1. Make sure QuickBooks Desktop is OPEN on this machine');
console.log('   2. Restart QB Connector service (tray icon → Stop → Start)');
console.log('   3. Wait ~60 seconds for first sync attempt');
console.log('   4. Verify: last_sync_status should change to "success"');
