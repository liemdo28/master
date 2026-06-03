"use strict";
// ============================================================
// Agent OS - Agent Adapter Handoff Artifacts
// Creates auditable handoff packages for IDE/extension agents.
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
exports.createAgentHandoff = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));
function resolveProjectPath(project) {
    if (path.isAbsolute(project))
        return project;
    return path.resolve(MASTER_ROOT, project);
}
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function getPrompt(task) {
    const payload = task.payload || {};
    return String(payload.prompt ||
        payload.handoffPrompt ||
        payload.commanderPlan?.handoffPrompt ||
        payload.originalMessage ||
        `Handle task ${task.id}`);
}
function createAgentHandoff(task, adapter, options) {
    const payload = task.payload || {};
    const projectPath = resolveProjectPath(String(payload.projectPath || task.project || MASTER_ROOT));
    const prompt = getPrompt(task);
    const taskId = String(task.id || `handoff-${Date.now()}`);
    const dir = path.join(MASTER_ROOT, 'artifact-registry', 'agent-handoffs', taskId);
    ensureDir(dir);
    const handoff = {
        taskId,
        adapter,
        status: options.status,
        nativeInjection: options.nativeInjection,
        reason: options.reason,
        project: task.project || payload.projectPath || MASTER_ROOT,
        projectPath,
        prompt,
        commanderIntent: payload.commanderIntent || null,
        executionStrategy: payload.executionStrategy || adapter,
        taskSize: payload.taskSize || null,
        qaRequired: payload.qaRequired ?? null,
        createdAt: new Date().toISOString(),
    };
    const jsonPath = path.join(dir, 'handoff.json');
    const promptPath = path.join(dir, 'PROMPT.md');
    fs.writeFileSync(jsonPath, JSON.stringify(handoff, null, 2), 'utf-8');
    fs.writeFileSync(promptPath, [
        '# Agent Handoff Prompt',
        '',
        `Adapter: ${adapter}`,
        `Task ID: ${taskId}`,
        `Project: ${handoff.project}`,
        `Project path: ${projectPath}`,
        `Native injection: ${options.nativeInjection ? 'true' : 'false'}`,
        `Status: ${options.status}`,
        '',
        '## Instructions',
        '',
        prompt,
        '',
        '## Rules',
        '',
        '- Do not guess. Use KNOWN_UNKNOWN if evidence is missing.',
        '- Report blockers at least 48h before a deadline slip.',
        '- If you disagree with the task direction, say it before execution.',
        '- Acceptance means the script or workflow runs on the CEO machine.',
        '- Never run global process-kill commands such as taskkill /F /IM node.exe, killall node, or broad npm/pnpm/yarn kills.',
        '- If a restart is required, identify the exact PID by port and project path first, then kill only that PID.',
        '- Do not stop PM2, the API gateway, Agent OS, or unrelated Node processes unless this handoff explicitly names that service.',
    ].join('\n'), 'utf-8');
    return {
        directory: dir,
        jsonPath,
        promptPath,
        projectPath,
        nativeInjection: options.nativeInjection,
        status: options.status,
    };
}
exports.createAgentHandoff = createAgentHandoff;
//# sourceMappingURL=agentAdapters.js.map