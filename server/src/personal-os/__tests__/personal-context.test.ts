import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PersonalOsStore } from '../store';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-personal-context-'));
}

function run() {
  const dir = tmp();
  let store = new PersonalOsStore(dir);
  const explicit = store.createPreference({
    category: 'workflow',
    key: 'language',
    value: 'Vietnamese by default for casual status',
    source: 'USER_STATED',
    provenance: 'user said so',
  });
  assert.strictEqual(explicit.status, 'ACTIVE');
  assert.strictEqual(explicit.lastConfirmedAt !== null, true);

  const inferred = store.createPreference({
    category: 'workflow',
    key: 'prefers-short-updates',
    value: 'likely prefers concise progress updates',
    source: 'MODEL_INFERRED',
    provenance: 'inferred from interaction pattern',
  });
  assert.strictEqual(inferred.status, 'NEEDS_CONFIRMATION');
  assert.ok(inferred.confidence < 1);

  const updated = store.updatePreference(explicit.id, { value: 'Vietnamese for status, English for code identifiers' });
  assert.strictEqual(updated.value.includes('English'), true);

  const deleted = store.deletePreference(updated.id);
  assert.strictEqual(deleted.status, 'DELETED');
  assert.ok(!store.listPreferences().some(item => item.id === deleted.id));

  assert.throws(() => store.createPreference({
    category: 'secret',
    key: 'token',
    value: 'api_key=should-not-store',
    provenance: 'test',
  }), /secret-like/);

  store.close();
  store = new PersonalOsStore(dir);
  assert.ok(store.getPreference(inferred.id));
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('[personal-context] PASS');
}

run();
