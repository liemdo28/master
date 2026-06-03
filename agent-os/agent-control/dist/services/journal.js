"use strict";
// ============================================================
// Agent OS - Master Journal Writer
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
exports.writeAiMemoryEntry = exports.writeDecision = exports.writeJournalEvent = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));
const JOURNAL_ROOT = path.join(MASTER_ROOT, 'master-journal');
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function writeJournalEvent(event) {
    const timestamp = new Date().toISOString();
    const record = { timestamp, ...event };
    const dir = path.join(JOURNAL_ROOT, 'events');
    ensureDir(dir);
    const file = path.join(dir, `${timestamp.slice(0, 10)}.jsonl`);
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf-8');
    return file;
}
exports.writeJournalEvent = writeJournalEvent;
function writeDecision(params) {
    const timestamp = new Date().toISOString();
    const dir = path.join(JOURNAL_ROOT, 'decisions');
    ensureDir(dir);
    const file = path.join(dir, `${timestamp.replace(/[:.]/g, '-')}-${params.taskId}.md`);
    const content = [
        '# Decision',
        '',
        `- Task: ${params.taskId}`,
        `- Decision: ${params.decision}`,
        `- Who approved: ${params.actor || 'ceo'}`,
        `- When: ${timestamp}`,
        `- Risk: ${params.risk || 'unknown'}`,
        '',
        '## Why',
        '',
        params.reason,
        '',
        '## Rollback Plan',
        '',
        params.rollbackPlan || 'Stop task, restore previous snapshot, and inspect artifacts.',
        '',
    ].join('\n');
    fs.writeFileSync(file, content, 'utf-8');
    return file;
}
exports.writeDecision = writeDecision;
function writeAiMemoryEntry(params) {
    const timestamp = new Date().toISOString();
    const dir = path.join(JOURNAL_ROOT, 'ai-memory');
    ensureDir(dir);
    const file = path.join(dir, `${timestamp.replace(/[:.]/g, '-')}-${params.taskId}-AI_MEMORY_ENTRY.md`);
    const content = [
        '# AI Memory Entry',
        '',
        `- Task: ${params.taskId}`,
        `- Project: ${params.project}`,
        `- When: ${timestamp}`,
        '',
        '## Business Reason',
        '',
        params.businessReason || 'Agent OS task execution.',
        '',
        '## Technical Reason',
        '',
        params.technicalReason || 'Task was created and processed through Agent OS.',
        '',
        '## Risk',
        '',
        params.risk || 'Review task logs and artifacts before release.',
        '',
        '## Warning',
        '',
        params.warning || 'No production deploy, file deletion, git push, cloud access, or email send should occur without approval.',
        '',
        '## Rollback Notes',
        '',
        params.rollbackNotes || 'Use MASTER-PREVIOUS.zip or project-specific restore procedure if this task causes regression.',
        '',
        '## Artifacts',
        '',
        ...(params.artifacts?.length ? params.artifacts.map(a => `- ${a}`) : ['- None recorded yet.']),
        '',
        '## QA Coverage',
        '',
        params.qaCoverage || 'Pending QA Platform integration result.',
        '',
    ].join('\n');
    fs.writeFileSync(file, content, 'utf-8');
    return file;
}
exports.writeAiMemoryEntry = writeAiMemoryEntry;
//# sourceMappingURL=journal.js.map