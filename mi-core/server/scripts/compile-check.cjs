#!/usr/bin/env node
// Quick TypeScript compile check for executive-coordination + routes/coordination
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const serverRoot = path.resolve(__dirname, '..');
const tsconfig = path.join(serverRoot, 'tsconfig.json');

if (!fs.existsSync(tsconfig)) {
  console.error('[FAIL] tsconfig.json not found at', tsconfig);
  process.exit(1);
}

console.log('[INFO] Compiling project with tsconfig.json...');
try {
  execSync(`npx tsc -p "${tsconfig}" --noEmit`, {
    cwd: serverRoot,
    stdio: 'inherit',
  });
  console.log('[OK] TypeScript compilation passed');
} catch (e) {
  console.error('[FAIL] TypeScript compilation failed');
  process.exit(1);
}