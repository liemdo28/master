# SQLite in Node.js — better-sqlite3 and WAL Mode

## Why SQLite for Local Applications

SQLite is a serverless, file-based relational database. It requires no installation, no network access, and no separate process. It is ideal for:
- Local desktop/CLI applications
- Embedded databases in offline agents
- Caching and local state persistence
- Small-to-medium read-heavy workloads

## better-sqlite3

`better-sqlite3` is the fastest synchronous SQLite library for Node.js. It is synchronous by design — all operations are blocking. This is an advantage for applications that don't benefit from query parallelism, as it avoids the complexity of callback/Promise APIs.

```bash
npm install better-sqlite3
```

```js
import Database from 'better-sqlite3';

const db = new Database('myapp.db');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL,
    email TEXT   UNIQUE
  )
`);

// Prepared statements (reusable, parameterised)
const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
insert.run('Alice', 'alice@example.com');

// Select single row
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(1);

// Select all rows
const users = db.prepare('SELECT * FROM users').all();

// Close when done
db.close();
```

## WAL Mode

Write-Ahead Logging (WAL) mode significantly improves concurrent read performance. In WAL mode:
- Readers never block writers
- Writers never block readers
- Multiple readers can proceed in parallel
- Only one writer at a time (serialised)
- Checkpointing happens automatically in the background

```js
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');    // safe with WAL, faster than FULL
db.pragma('foreign_keys = ON');       // enable FK constraint checking
db.pragma('cache_size = -64000');     // 64 MB page cache
```

Always enable WAL for applications with mixed reads and writes. The performance improvement can be 2-10x for read-heavy workloads.

## Transactions

Wrapping multiple statements in a transaction is dramatically faster for bulk inserts:

```js
const insertMany = db.transaction((rows) => {
  const stmt = db.prepare('INSERT INTO items (name, value) VALUES (?, ?)');
  for (const row of rows) {
    stmt.run(row.name, row.value);
  }
});

insertMany(data);  // atomic — all succeed or all fail
```

A 1000-row insert inside a transaction is typically 100x faster than 1000 individual inserts (each auto-commit is a full fsync cycle).

## FTS5 Full-Text Search

SQLite has a built-in full-text search extension, FTS5:

```sql
CREATE VIRTUAL TABLE docs_fts USING fts5(
  content,
  content='docs',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Sync triggers
CREATE TRIGGER docs_ai AFTER INSERT ON docs BEGIN
  INSERT INTO docs_fts(rowid, content) VALUES (new.id, new.content);
END;

-- Search
SELECT * FROM docs_fts WHERE docs_fts MATCH 'javascript async';

-- Ranked search using BM25
SELECT rowid, bm25(docs_fts) AS score
FROM docs_fts
WHERE docs_fts MATCH 'javascript async'
ORDER BY score;
```

## Parameterised Queries

Always use parameterised queries to prevent SQL injection:

```js
// Safe — parameter binding
const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

// UNSAFE — string concatenation
const row = db.all(`SELECT * FROM users WHERE email = '${email}'`);  // never do this
```

## Error Handling

```js
try {
  db.prepare('INSERT INTO users (email) VALUES (?)').run(email);
} catch (err) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.log('Email already exists');
  } else {
    throw err;
  }
}
```

## Memory Mode

For tests or temporary storage, open an in-memory database:

```js
const db = new Database(':memory:');
```

In-memory databases are fast but lost when the process exits.

## Sources

- better-sqlite3 documentation — MIT License (Ben Johnson)
- SQLite Documentation — Public Domain (D. Richard Hipp)
- Node.js Foundation — MIT License
