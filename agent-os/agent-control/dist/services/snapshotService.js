"use strict";
// ============================================================
// Agent OS - Master Snapshot Service
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMasterSnapshot = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const journal_1 = require("./journal");
const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));
const SNAPSHOT_DIR = path.join(MASTER_ROOT, '_snapshots');
const LATEST = path.join(SNAPSHOT_DIR, 'MASTER-LATEST.zip');
const PREVIOUS = path.join(SNAPSHOT_DIR, 'MASTER-PREVIOUS.zip');
const LOCK_FILE = path.join(SNAPSHOT_DIR, 'SNAPSHOT-RUNNING.lock');
const EXCLUDE_PATTERN = '\\(node_modules|vendor|\\.git|cache|dist|build|logs|coverage|_snapshots|\\.venv|venv|\\.next)\\';
function createMasterSnapshot(reason, taskId) {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }
    if (fs.existsSync(LOCK_FILE)) {
        (0, journal_1.writeJournalEvent)({
            type: 'snapshot_skipped',
            taskId,
            actor: 'agent-os',
            data: { reason, lockFile: LOCK_FILE, message: 'snapshot already running' },
        });
        return { latest: LATEST, previous: fs.existsSync(PREVIOUS) ? PREVIOUS : null, status: 'skipped' };
    }
    const script = [
        '$ErrorActionPreference = "Stop"',
        `$root = ${JSON.stringify(MASTER_ROOT)}`,
        `$dest = ${JSON.stringify(LATEST)}`,
        `$staging = Join-Path ${JSON.stringify(SNAPSHOT_DIR)} ".snapshot-staging"`,
        `$lock = ${JSON.stringify(LOCK_FILE)}`,
        `$exclude = ${JSON.stringify(EXCLUDE_PATTERN)}`,
        `$previous = ${JSON.stringify(PREVIOUS)}`,
        'Set-Content -LiteralPath $lock -Value (Get-Date).ToString("o")',
        'try {',
        'if (Test-Path -LiteralPath $previous) { Remove-Item -LiteralPath $previous -Force }',
        'if (Test-Path -LiteralPath $dest) { Rename-Item -LiteralPath $dest -NewName "MASTER-PREVIOUS.zip" -Force }',
        'if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }',
        'New-Item -ItemType Directory -Force -Path $staging | Out-Null',
        '$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object { $_.FullName -notmatch $exclude }',
        'foreach ($file in $files) {',
        '  $rel = $file.FullName.Substring($root.Length).TrimStart("\\")',
        '  $target = Join-Path $staging $rel',
        '  $targetDir = Split-Path -Parent $target',
        '  if (!(Test-Path -LiteralPath $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }',
        '  Copy-Item -LiteralPath $file.FullName -Destination $target -Force',
        '}',
        '$items = Get-ChildItem -LiteralPath $staging -Force',
        'Compress-Archive -Path $items.FullName -DestinationPath $dest -Force',
        'Remove-Item -LiteralPath $staging -Recurse -Force',
        '} finally {',
        'if (Test-Path -LiteralPath $lock) { Remove-Item -LiteralPath $lock -Force }',
        'if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }',
        '}',
    ].join('; ');
    const jobFile = path.join(SNAPSHOT_DIR, `SNAPSHOT-JOB-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(jobFile, JSON.stringify({ reason, taskId, latest: LATEST, previous: PREVIOUS, startedAt: new Date().toISOString() }, null, 2), 'utf-8');
    const child = (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        cwd: MASTER_ROOT,
        detached: true,
        stdio: 'ignore',
    });
    child.unref();
    (0, journal_1.writeJournalEvent)({
        type: 'snapshot_started',
        taskId,
        actor: 'agent-os',
        data: { reason, latest: LATEST, previous: PREVIOUS, jobFile },
    });
    return { latest: LATEST, previous: fs.existsSync(PREVIOUS) ? PREVIOUS : null, status: 'started' };
}
exports.createMasterSnapshot = createMasterSnapshot;
//# sourceMappingURL=snapshotService.js.map