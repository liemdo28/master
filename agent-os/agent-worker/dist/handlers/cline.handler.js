"use strict";
// ============================================================
// Agent OS - Worker - Cline Handler
// Calls Antigravity AI Gateway directly (no clite dependency)
// Gateway: http://localhost:3456 — Anthropic Messages API compat
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
exports.handleCline = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const GATEWAY_URL = process.env.AI_GATEWAY_URL ?? 'http://localhost:3456';
const GATEWAY_KEY = process.env.AI_GATEWAY_KEY ?? 'antigravity-local';
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
async function handleCline(task, streamLog) {
    const payload = task.payload;
    if (!payload?.prompt)
        throw new Error('Cline task requires a prompt');
    const projectPath = payload.projectPath ?? task.project ?? process.cwd();
    const model = payload.model ?? DEFAULT_MODEL;
    if (!fs.existsSync(projectPath)) {
        throw new Error(`Project path not found: ${projectPath}`);
    }
    streamLog('info', `[AI] Task: ${payload.prompt.slice(0, 80)}...`);
    streamLog('info', `[AI] Project: ${projectPath}`);
    streamLog('info', `[AI] Model: ${model} via ${GATEWAY_URL}`);
    // Build context from project
    const context = buildProjectContext(projectPath, payload.context_files);
    // Run agent loop: AI → execute tools → AI → ...
    await runAgentLoop(payload.prompt, context, projectPath, model, task.timeout ?? 3600, streamLog);
}
exports.handleCline = handleCline;
const TOOLS = [
    {
        name: 'bash',
        description: 'Run a shell command in the project directory. Use for: npm install, npm run build, git commands, etc.',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Shell command to run' },
            },
            required: ['command'],
        },
    },
    {
        name: 'write_file',
        description: 'Create or overwrite a file with given content.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path relative to project root' },
                content: { type: 'string', description: 'File content' },
            },
            required: ['path', 'content'],
        },
    },
    {
        name: 'read_file',
        description: 'Read a file and return its content.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path relative to project root' },
            },
            required: ['path'],
        },
    },
];
async function runAgentLoop(prompt, context, projectPath, model, timeoutSecs, streamLog) {
    const systemPrompt = `You are an autonomous coding agent. You work in the project directory: ${projectPath}

${context}

Hard safety rules:
- Never run global process-kill commands such as "taskkill /F /IM node.exe", "killall node", or broad npm/pnpm/yarn kills.
- If a server must be restarted, identify the exact PID by port and project path first, then kill only that PID.
- Do not stop PM2, the API gateway, Agent OS, or unrelated Node processes unless the task explicitly names that service.
- Prefer PM2 service restart by exact process name when a managed service needs restart.

Complete the user's task by using the available tools. Be concise and efficient.
After completing the task, provide a brief summary of what was done.`;
    const messages = [
        { role: 'user', content: prompt },
    ];
    const startTime = Date.now();
    const maxIterations = 10;
    for (let i = 0; i < maxIterations; i++) {
        if (Date.now() - startTime > timeoutSecs * 1000) {
            streamLog('warn', '[AI] Timeout reached');
            break;
        }
        streamLog('info', `[AI] Iteration ${i + 1}/${maxIterations}`);
        const response = await callGateway(model, systemPrompt, messages, streamLog);
        if (!response)
            throw new Error('No response from AI gateway');
        // Check stop reason
        if (response.stop_reason === 'end_turn') {
            // Extract final text
            const textBlock = response.content?.find((b) => b.type === 'text');
            if (textBlock?.text) {
                streamLog('ok', `[AI] Done: ${textBlock.text.slice(0, 200)}`);
            }
            break;
        }
        if (response.stop_reason === 'tool_use') {
            // Add assistant message
            messages.push({ role: 'assistant', content: response.content });
            // Execute all tool calls
            const toolResults = [];
            for (const block of response.content) {
                if (block.type !== 'tool_use')
                    continue;
                const result = await executeTool(block.name, block.input, projectPath, streamLog);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: result,
                });
            }
            // Add tool results
            messages.push({ role: 'user', content: toolResults });
            continue;
        }
        // Unexpected stop reason
        streamLog('warn', `[AI] Unexpected stop_reason: ${response.stop_reason}`);
        break;
    }
}
// ── Gateway call ─────────────────────────────────────────────
async function callGateway(model, systemPrompt, messages, streamLog) {
    const body = JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages,
    });
    const url = new URL(`${GATEWAY_URL}/v1/messages`);
    const isHttps = url.protocol === 'https:';
    return new Promise((resolve, reject) => {
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GATEWAY_KEY}`,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(body),
            },
        };
        const lib = isHttps ? https : http;
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode && res.statusCode >= 400) {
                        streamLog('error', `[AI] Gateway error ${res.statusCode}: ${data.slice(0, 200)}`);
                        reject(new Error(`Gateway returned ${res.statusCode}`));
                        return;
                    }
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error(`Invalid JSON from gateway: ${data.slice(0, 100)}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Gateway request timed out (60s)'));
        });
        req.write(body);
        req.end();
    });
}
// ── Tool execution ────────────────────────────────────────────
async function executeTool(name, input, projectPath, streamLog) {
    switch (name) {
        case 'bash': {
            streamLog('info', `[cmd] ${input.command}`);
            const result = await runCommand(input.command, projectPath);
            const output = (result.stdout + result.stderr).slice(0, 2000);
            if (result.exitCode !== 0) {
                streamLog('warn', `[cmd] exit ${result.exitCode}: ${result.stderr.slice(0, 100)}`);
            }
            else {
                streamLog('ok', `[cmd] exit 0`);
            }
            return output || `exit code ${result.exitCode}`;
        }
        case 'write_file': {
            const filePath = path.resolve(projectPath, input.path);
            // Safety: only write inside project directory
            if (!filePath.startsWith(path.resolve(projectPath))) {
                return 'Error: cannot write outside project directory';
            }
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, input.content, 'utf-8');
            streamLog('ok', `[write] ${input.path}`);
            return `Written ${input.content.length} bytes to ${input.path}`;
        }
        case 'read_file': {
            const filePath = path.resolve(projectPath, input.path);
            if (!fs.existsSync(filePath))
                return `File not found: ${input.path}`;
            const content = fs.readFileSync(filePath, 'utf-8');
            streamLog('info', `[read] ${input.path} (${content.length} chars)`);
            return content.slice(0, 4000);
        }
        default:
            return `Unknown tool: ${name}`;
    }
}
// ── Helpers ───────────────────────────────────────────────────
function runCommand(cmd, cwd) {
    const blocked = explainBlockedCommand(cmd);
    if (blocked) {
        return Promise.resolve({ stdout: '', stderr: blocked, exitCode: 126 });
    }
    return new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)(cmd, [], { shell: true, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
        proc.on('error', (err) => resolve({ stdout, stderr: err.message, exitCode: 1 }));
    });
}
function explainBlockedCommand(cmd) {
    const normalized = cmd.toLowerCase().replace(/\s+/g, ' ').trim();
    const globalNodeKill = /taskkill\b.*\/im\s+node(\.exe)?\b/.test(normalized) ||
        /\bkillall\s+node\b/.test(normalized) ||
        /\bpkill\s+.*\bnode\b/.test(normalized);
    if (globalNodeKill) {
        return [
            'BLOCKED_UNSAFE_COMMAND: global Node kill is not allowed.',
            'Use netstat/Get-CimInstance to identify the exact PID by port and project path, then kill only that PID.',
        ].join(' ');
    }
    return null;
}
function buildProjectContext(projectPath, contextFiles) {
    const lines = [];
    // List top-level files
    try {
        const items = fs.readdirSync(projectPath)
            .filter(f => !f.startsWith('.') && f !== 'node_modules' && f !== 'dist')
            .slice(0, 20);
        lines.push(`Project files: ${items.join(', ')}`);
    }
    catch { }
    // Read package.json if exists
    const pkgPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            lines.push(`Package: ${pkg.name ?? 'unknown'} v${pkg.version ?? '?'}`);
            if (pkg.scripts)
                lines.push(`Scripts: ${Object.keys(pkg.scripts).join(', ')}`);
        }
        catch { }
    }
    // Read specified context files
    if (contextFiles?.length) {
        for (const f of contextFiles) {
            const p = path.resolve(projectPath, f);
            if (fs.existsSync(p)) {
                try {
                    lines.push(`\n--- ${f} ---\n${fs.readFileSync(p, 'utf-8').slice(0, 1000)}`);
                }
                catch { }
            }
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=cline.handler.js.map