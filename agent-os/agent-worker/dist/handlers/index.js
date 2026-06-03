"use strict";
// ============================================================
// Agent OS - Worker - Task Handlers
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleClineTask = exports.handleLaunch = exports.handleScript = exports.handleAudit = exports.handleGitSync = exports.handleQA = exports.handleBuild = void 0;
const worker_1 = require("../worker");
const axios_1 = __importDefault(require("axios"));
const cline_handler_1 = require("./cline.handler");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const uuid_1 = require("uuid");
const agentAdapters_1 = require("./agentAdapters");
const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));
const APPROVED_SCRIPT_PATHS = new Set([
    path.resolve(MASTER_ROOT, 'Agent', 'agent-coding-api-keys', 'start-proxy-background.ps1').toLowerCase(),
]);
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
function isWindowsProcessRunning(imageName) {
    try {
        const output = (0, child_process_1.execFileSync)('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'], {
            encoding: 'utf-8',
            windowsHide: true,
        });
        return output.toLowerCase().includes(imageName.toLowerCase());
    }
    catch {
        return false;
    }
}
// Helper to report progress
async function reportProgress(taskId, progress, message) {
    try {
        await axios_1.default.post(`${worker_1.CONTROL_URL}/api/tasks/${taskId}/progress`, {
            progress,
            message,
        }, {
            headers: { 'x-worker-token': worker_1.workerToken },
        });
    }
    catch { }
}
// ============================================================
// BUILD HANDLER
// ============================================================
async function handleBuild(task) {
    const { payload } = task;
    const project = resolveProjectPath(task.project);
    (0, worker_1.log)('info', `Building project: ${project}`);
    // Validate project exists
    if (!fs.existsSync(project)) {
        throw new Error(`Project not found: ${project}`);
    }
    const packageJson = path.join(project, 'package.json');
    const hasNpm = fs.existsSync(packageJson);
    const hasComposer = fs.existsSync(path.join(project, 'composer.json'));
    const hasRequirements = fs.existsSync(path.join(project, 'requirements.txt'));
    const hasGoMod = fs.existsSync(path.join(project, 'go.mod'));
    const hasCargo = fs.existsSync(path.join(project, 'Cargo.toml'));
    let buildCommand = '';
    let buildSteps = [];
    if (hasNpm) {
        // Node.js project
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        (0, worker_1.log)('info', `Node.js project detected: ${pkg.name || 'unnamed'}`);
        // Git pull if git repo
        if (fs.existsSync(path.join(project, '.git'))) {
            (0, worker_1.log)('info', 'Git pull...');
            await (0, worker_1.execCommand)('git pull', project);
        }
        // Install dependencies
        (0, worker_1.log)('info', 'Installing dependencies...');
        const installResult = await (0, worker_1.execCommand)('npm install', project);
        if (installResult.exitCode !== 0) {
            throw new Error(`npm install failed: ${installResult.stderr}`);
        }
        // Build
        if (pkg.scripts?.build) {
            (0, worker_1.log)('info', 'Running build script...');
            const buildResult = await (0, worker_1.execCommand)('npm run build', project);
            if (buildResult.exitCode !== 0) {
                throw new Error(`Build failed: ${buildResult.stderr}`);
            }
        }
        else if (pkg.scripts?.compile) {
            (0, worker_1.log)('info', 'Running compile script...');
            const buildResult = await (0, worker_1.execCommand)('npm run compile', project);
            if (buildResult.exitCode !== 0) {
                throw new Error(`Build failed: ${buildResult.stderr}`);
            }
        }
        else {
            (0, worker_1.log)('info', 'No build script defined, skipping build');
        }
        // Run tests if configured
        if (payload?.runTests && pkg.scripts?.test) {
            (0, worker_1.log)('info', 'Running tests...');
            const testResult = await (0, worker_1.execCommand)('npm test', project);
            if (testResult.exitCode !== 0) {
                (0, worker_1.log)('warn', 'Tests failed', { output: testResult.stdout });
            }
        }
    }
    else if (hasComposer) {
        // PHP project
        (0, worker_1.log)('info', 'PHP project detected');
        await (0, worker_1.execCommand)('composer install', project);
    }
    else if (hasRequirements) {
        // Python project
        (0, worker_1.log)('info', 'Python project detected');
        await (0, worker_1.execCommand)('pip install -r requirements.txt', project);
    }
    (0, worker_1.log)('info', 'Build completed successfully');
}
exports.handleBuild = handleBuild;
// ============================================================
// QA HANDLER
// ============================================================
async function handleQA(task) {
    const { payload } = task;
    const project = resolveProjectPath(task.project);
    (0, worker_1.log)('info', `Running QA for project: ${project}`);
    if (!fs.existsSync(project)) {
        throw new Error(`Project not found: ${project}`);
    }
    const packageJson = path.join(project, 'package.json');
    const hasPlaywright = [
        'playwright.config.ts',
        'playwright.config.js',
        'playwright.config.mjs',
        'playwright.config.cjs',
    ].some(file => fs.existsSync(path.join(project, file)));
    const hasCypress = fs.existsSync(path.join(project, 'cypress'));
    const results = {
        id: (0, uuid_1.v4)(),
        taskId: task.id,
        timestamp: new Date().toISOString(),
        project,
        engine: 'qa-platform',
        tests: [],
    };
    if (hasPlaywright) {
        (0, worker_1.log)('info', 'Running Playwright tests...');
        const result = await (0, worker_1.execCommand)('npx playwright test --reporter=list', project);
        results.tests.push({
            type: 'playwright',
            exitCode: result.exitCode,
            output: result.stdout + result.stderr,
        });
    }
    if (hasCypress) {
        (0, worker_1.log)('info', 'Running Cypress tests...');
        const result = await (0, worker_1.execCommand)('npx cypress run', project);
        results.tests.push({
            type: 'cypress',
            exitCode: result.exitCode,
            output: result.stdout + result.stderr,
        });
    }
    if (fs.existsSync(packageJson)) {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        if (pkg.scripts?.test) {
            (0, worker_1.log)('info', 'Running unit tests...');
            const result = await (0, worker_1.execCommand)('npm test', project);
            results.tests.push({
                type: 'unit',
                exitCode: result.exitCode,
                output: result.stdout + result.stderr,
            });
        }
    }
    if (results.tests.length === 0) {
        results.tests.push({
            type: 'structure',
            exitCode: 0,
            output: 'No executable test runner detected. Structural QA completed.',
        });
    }
    // Generate report artifact outside the product tree.
    const artifactDir = path.join(MASTER_ROOT, 'qa-platform', 'artifacts', path.basename(project));
    ensureDir(artifactDir);
    const reportPath = path.join(artifactDir, `qa-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    (0, worker_1.log)('info', 'QA report generated', { path: reportPath });
    // Check if any tests failed
    const failedTests = results.tests.filter((t) => t.exitCode !== 0);
    if (failedTests.length > 0) {
        (0, worker_1.log)('warn', `${failedTests.length} test(s) failed`);
    }
    else {
        (0, worker_1.log)('info', 'All tests passed');
    }
}
exports.handleQA = handleQA;
// ============================================================
// GIT SYNC HANDLER
// ============================================================
async function handleGitSync(task) {
    const { payload } = task;
    const project = resolveProjectPath(task.project);
    (0, worker_1.log)('info', `Git sync for project: ${project}`);
    if (!fs.existsSync(project)) {
        throw new Error(`Project not found: ${project}`);
    }
    const gitDir = path.join(project, '.git');
    if (!fs.existsSync(gitDir)) {
        const statusAllScript = path.join(MASTER_ROOT, 'git-status-all.ps1');
        if (payload?.scope === 'all_repositories' && fs.existsSync(statusAllScript)) {
            (0, worker_1.log)('info', 'Root is not a git repository; running approved all-repository status script');
            const statusResult = await (0, worker_1.execCommand)(`powershell -NoProfile -ExecutionPolicy Bypass -File "${statusAllScript}"`, MASTER_ROOT);
            if (statusResult.exitCode !== 0) {
                throw new Error(`Git status all failed: ${statusResult.stderr}`);
            }
            (0, worker_1.log)('info', 'Git status all completed');
            return;
        }
        throw new Error('Not a git repository');
    }
    const operations = payload?.operations || ['status', 'pull'];
    const results = {};
    for (const op of operations) {
        (0, worker_1.log)('info', `Git operation: ${op}`);
        switch (op) {
            case 'status':
                const statusResult = await (0, worker_1.execCommand)('git status --short', project);
                results.status = statusResult.stdout;
                (0, worker_1.log)('info', `Status:\n${statusResult.stdout}`);
                break;
            case 'pull':
                const pullResult = await (0, worker_1.execCommand)('git pull', project);
                results.pull = { exitCode: pullResult.exitCode, output: pullResult.stdout + pullResult.stderr };
                if (pullResult.exitCode !== 0) {
                    (0, worker_1.log)('warn', `Pull failed: ${pullResult.stderr}`);
                }
                else {
                    (0, worker_1.log)('info', 'Pull successful');
                }
                break;
            case 'fetch':
                await (0, worker_1.execCommand)('git fetch --all', project);
                results.fetch = { success: true };
                (0, worker_1.log)('info', 'Fetch successful');
                break;
            case 'log':
                const logResult = await (0, worker_1.execCommand)('git log --oneline -10', project);
                results.log = logResult.stdout;
                (0, worker_1.log)('info', `Recent commits:\n${logResult.stdout}`);
                break;
        }
    }
    (0, worker_1.log)('info', 'Git sync completed', results);
}
exports.handleGitSync = handleGitSync;
// ============================================================
// AUDIT HANDLER
// ============================================================
async function handleAudit(task) {
    const project = resolveProjectPath(task.project);
    (0, worker_1.log)('info', `Auditing project: ${project}`);
    if (!fs.existsSync(project)) {
        throw new Error(`Project not found: ${project}`);
    }
    const auditReport = {
        id: (0, uuid_1.v4)(),
        project,
        timestamp: new Date().toISOString(),
        stats: {},
        files: {},
        languages: [],
        frameworks: [],
        dependencies: {},
        security: {},
    };
    // Count files by extension
    const countFiles = (dir, pattern) => {
        let count = 0;
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.name.startsWith('.') || item.name === 'node_modules')
                    continue;
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    count += countFiles(fullPath, pattern);
                }
                else if (pattern.test(item.name)) {
                    count++;
                }
            }
        }
        catch { }
        return count;
    };
    auditReport.stats = {
        totalFiles: countFiles(project, /.*/),
        sourceFiles: countFiles(project, /\.(ts|js|tsx|jsx)$/),
        styleFiles: countFiles(project, /\.(css|scss|sass|less)$/),
        configFiles: countFiles(project, /\.(json|yaml|yml|toml|ini)$/),
        docFiles: countFiles(project, /\.(md|txt|rst)$/),
    };
    // Detect languages and frameworks
    if (fs.existsSync(path.join(project, 'package.json'))) {
        auditReport.languages.push('JavaScript/TypeScript');
        const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf-8'));
        auditReport.dependencies = pkg.dependencies || {};
        auditReport.frameworks = Object.keys({
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
        }).filter(dep => ['react', 'vue', 'angular', 'next', 'nuxt', 'express', 'nest', 'svelte', 'electron'].some(f => dep.includes(f)));
    }
    if (fs.existsSync(path.join(project, 'composer.json'))) {
        auditReport.languages.push('PHP');
    }
    if (fs.existsSync(path.join(project, 'requirements.txt'))) {
        auditReport.languages.push('Python');
    }
    if (fs.existsSync(path.join(project, 'go.mod'))) {
        auditReport.languages.push('Go');
    }
    // Security checks
    const packageJson = path.join(project, 'package.json');
    if (fs.existsSync(packageJson)) {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        const deprecated = ['request', 'moment', 'request-promise'];
        auditReport.security.deprecatedPackages = Object.keys(pkg.dependencies || {}).filter(dep => deprecated.includes(dep));
    }
    // Check for sensitive files
    const sensitiveFiles = ['.env', '.env.local', 'config/secrets.json', 'secrets.json'];
    auditReport.security.sensitiveFilesFound = sensitiveFiles.filter(f => fs.existsSync(path.join(project, f)));
    // Save audit report
    const reportDir = path.join(MASTER_ROOT, 'qa-platform', 'artifacts', path.basename(project));
    ensureDir(reportDir);
    const reportPath = path.join(reportDir, `audit-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
    (0, worker_1.log)('info', 'Audit completed', {
        stats: auditReport.stats,
        languages: auditReport.languages,
        frameworks: auditReport.frameworks,
        reportPath,
    });
}
exports.handleAudit = handleAudit;
// ============================================================
// SCRIPT HANDLER
// ============================================================
async function handleScript(task) {
    const { payload } = task;
    const project = resolveProjectPath(task.project);
    (0, worker_1.log)('info', `Running registry script intent: ${payload?.registryIntent || 'none'}`);
    if (!payload?.registryIntent) {
        throw new Error('Raw shell blocked: script tasks must come from COMMAND_REGISTRY.json.');
    }
    let fullCommand = '';
    if (payload.scriptPath) {
        const resolvedScript = path.resolve(String(payload.scriptPath));
        if (!APPROVED_SCRIPT_PATHS.has(resolvedScript.toLowerCase())) {
            throw new Error(`Raw shell blocked: script path is not approved: ${resolvedScript}`);
        }
        fullCommand = resolvedScript.toLowerCase().endsWith('.ps1')
            ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${resolvedScript}"`
            : `"${resolvedScript}"`;
    }
    else if (payload.rawShellApproved === true && payload.command) {
        fullCommand = String(payload.command);
    }
    else {
        throw new Error('Raw shell blocked: no approved script path or explicit rawShellApproved payload.');
    }
    (0, worker_1.log)('info', `Executing: ${fullCommand}`);
    const result = await (0, worker_1.execCommand)(fullCommand, project);
    if (result.exitCode !== 0 && payload?.required !== false) {
        throw new Error(`Script failed with exit code ${result.exitCode}: ${result.stderr}`);
    }
    (0, worker_1.log)('info', 'Script execution completed', {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length,
    });
}
exports.handleScript = handleScript;
// ============================================================
// LAUNCH HANDLER
// ============================================================
async function handleLaunch(task) {
    const { payload } = task;
    const app = String(payload?.app || '').toLowerCase();
    if (payload?.registryIntent !== 'open_antigravity' || app !== 'antigravity') {
        throw new Error('Launch blocked: app launch must come from an approved registry intent.');
    }
    const candidates = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Antigravity', 'Antigravity.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Antigravity', 'Antigravity.exe'),
    ].filter(Boolean);
    const executable = candidates.find(candidate => fs.existsSync(candidate));
    if (!executable) {
        throw new Error('Antigravity executable not found in approved install locations.');
    }
    const projectPath = resolveProjectPath(String(payload?.projectPath || task.project || MASTER_ROOT));
    const handoff = (0, agentAdapters_1.createAgentHandoff)(task, 'antigravity', {
        status: 'opened_antigravity_ready_for_manual_injection',
        nativeInjection: false,
        reason: 'Antigravity native Agent Manager injection API is not exposed to this worker yet.',
    });
    const args = fs.existsSync(projectPath) ? [projectPath] : [];
    (0, worker_1.log)('info', 'Launching approved app', {
        app,
        executable,
        project: task.project,
        projectPath,
        handoff,
        handoffPrompt: payload?.handoffPrompt,
    });
    if (isWindowsProcessRunning('Antigravity.exe') || isWindowsProcessRunning('Antigravity IDE.exe')) {
        (0, worker_1.log)('info', 'Antigravity already running; handoff artifact generated without spawning a duplicate IDE process', {
            handoff,
        });
        return {
            adapter: 'antigravity',
            launched: false,
            alreadyRunning: true,
            pid: null,
            handoff,
            nativeInjection: false,
        };
    }
    const child = (0, child_process_1.spawn)(executable, args, {
        cwd: fs.existsSync(projectPath) ? projectPath : MASTER_ROOT,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
    });
    child.unref();
    (0, worker_1.log)('info', 'Launch command handed off', { pid: child.pid || null, handoff });
    return {
        adapter: 'antigravity',
        launched: true,
        pid: child.pid || null,
        handoff,
        nativeInjection: false,
    };
}
exports.handleLaunch = handleLaunch;
// ============================================================
// CLINE HANDLER (wrapper for cline.handler.ts)
// ============================================================
async function handleClineTask(task) {
    const streamLog = (level, message, data) => (0, worker_1.log)(level, message, data);
    if (task.payload?.autoExecute === true) {
        await (0, cline_handler_1.handleCline)(task, streamLog);
        return {
            adapter: 'cline',
            mode: 'gateway_agent',
            autoExecute: true,
        };
    }
    const handoff = (0, agentAdapters_1.createAgentHandoff)(task, 'cline', {
        status: 'ready_for_cline_extension',
        nativeInjection: false,
        reason: 'Cline VS Code extension does not expose a stable local task injection API to this worker.',
    });
    (0, worker_1.log)('info', 'Cline extension handoff generated', {
        taskId: task.id,
        handoff,
    });
    return {
        adapter: 'cline',
        mode: 'extension_handoff',
        handoff,
        nativeInjection: false,
        manualAction: 'Open the Cline extension and paste PROMPT.md.',
    };
}
exports.handleClineTask = handleClineTask;
//# sourceMappingURL=index.js.map