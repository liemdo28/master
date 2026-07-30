# Node.js Module Systems — CommonJS and ES Modules

## Overview

Node.js supports two module systems: the original **CommonJS (CJS)** system and the modern **ES Modules (ESM)** system specified in ECMAScript 2015+. They differ in syntax, loading semantics, and interoperability.

## CommonJS

CommonJS is the original Node.js module system. Files use `.js` extension by default and modules are identified by file paths or package names.

```js
// Importing
const fs      = require('fs');
const { join } = require('path');
const myLib   = require('./lib/myLib');

// Exporting
module.exports = { foo, bar };
// or single export
module.exports = function createServer(opts) { ... };
```

CommonJS loading is **synchronous** — `require()` blocks and returns the fully-loaded module. This is fine for startup (disk I/O during init), but not suitable in async contexts.

**Caching:** Once a module is loaded, its exports object is cached. Subsequent `require()` calls return the cached object — mutations to it are visible to all consumers.

## ES Modules

ESM uses `import` and `export` statements. To use ESM in Node.js:
- Use `.mjs` extension, OR
- Set `"type": "module"` in `package.json` (then `.js` files are treated as ESM)

```js
// Named exports
export function add(a, b) { return a + b; }
export const PI = 3.14159;

// Default export
export default class Calculator { ... }

// Re-export
export { add, PI } from './math.js';
export * from './helpers.js';
```

```js
// Named imports
import { add, PI } from './math.js';

// Default import
import Calculator from './Calculator.js';

// Namespace import
import * as utils from './utils.js';

// Side-effect only
import './polyfills.js';

// Dynamic import (returns Promise)
const { parse } = await import('some-module');
```

ESM loading is **asynchronous** and **static** — the import graph is resolved before execution. This enables static analysis, tree-shaking, and top-level `await`.

## Top-Level await

In ESM files, `await` can be used at the module's top level (outside any function):

```js
// config.js (ESM)
const config = await fetch('/api/config').then(r => r.json());
export default config;
```

Modules that import `config.js` will wait for it to resolve before their own code runs.

## Interoperability

**ESM importing CJS:**
```js
import cjsModule from './legacy.cjs';  // gets module.exports as default
```

**CJS importing ESM:** Not directly possible with `require()`. Use dynamic `import()`:
```js
async function loadESM() {
  const { foo } = await import('./modern.mjs');
}
```

## Module Resolution

Node.js resolves modules in this order:
1. Core modules (`fs`, `path`, `http`, etc.)
2. `node_modules` directory traversal (up the directory tree)
3. File path (relative `./` or absolute `/`)

For ESM, extensions are **mandatory** in relative imports: `import './foo.js'` not `import './foo'`.

The `"exports"` field in `package.json` enables conditional exports (e.g., different entry points for CJS vs ESM consumers).

## `__dirname` and `__filename` in ESM

These CommonJS globals are not available in ESM. Use `import.meta.url` instead:

```js
import { fileURLToPath } from 'url';
import { dirname }       from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
```

## Package.json Module Configuration

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

## Sources

- Node.js Documentation: Modules — MIT License
- MDN Web Docs: JavaScript Modules — CC BY-SA 2.5 (Mozilla Contributors)
