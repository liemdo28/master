#!/usr/bin/env node
// cli/accounting.js - CLI entry point (delegates to bin/accounting.js)
// This file satisfies path requirements from dev scripts; logic lives in bin/
import { fileURLToPath } from 'url';
import { join, dirname }  from 'path';
import { createRequire }  from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Re-export everything from bin so both paths work
const binPath = join(__dirname, '..', 'bin', 'accounting.js');
await import(binPath);
