// Autonomous Patch Applier — PATCH-REAL-001
// Adds data-testid="admin-task-inspect-btn" to the Inspect button in AdminTasksPage.tsx
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', '..', 'apps', 'agency', 'frontend', 'src', 'pages', 'AdminTasksPage.tsx');

const content = fs.readFileSync(FILE, 'utf8');

// Detect line endings
const useCRLF = content.includes('\r\n');
const EOL = useCRLF ? '\r\n' : '\n';

const oldBlock =
  '                        className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs hover:bg-slate-700"' + EOL +
  '                      >' + EOL +
  '                        Inspect';

const newBlock =
  '                        className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs hover:bg-slate-700"' + EOL +
  '                        data-testid="admin-task-inspect-btn"' + EOL +
  '                      >' + EOL +
  '                        Inspect';

if (!content.includes(oldBlock)) {
  console.error('PATCH_FAIL: target block not found');
  process.exit(2);
}

if (content.includes('data-testid="admin-task-inspect-btn"')) {
  console.log('ALREADY_PATCHED');
  process.exit(0);
}

const updated = content.replace(oldBlock, newBlock);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('PATCH_APPLIED');
