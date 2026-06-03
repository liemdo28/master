"use strict";
// ============================================================
// Agent OS Worker — Task-based Command Handlers (D2-D6)
// These handlers are registered in the task handlers map and
// return a payload object that is forwarded to the control plane.
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
exports.handleStatusApiProxy = exports.handleStopApiProxy = exports.handleStartApiProxy = exports.handleCloseAntigravity = exports.handleOpenAntigravity = exports.handlePing = void 0;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
const worker_1 = require("../worker");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// ── D2: ping ─────────────────────────────────────────────────────────────
async function handlePing(task) {
    return {
        status: 'pong',
        hostname: os.hostname(),
        worker_name: process.env.WORKER_NAME ?? os.hostname(),
        version: '0.1.0',
        ts: new Date().toISOString(),
    };
}
exports.handlePing = handlePing;
// ── D3: open-antigravity ─────────────────────────────────────────────────
const ANTIGRAVITY_PATH = 'C:\\Users\\liemdo\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe';
async function getWindowTitle(processName) {
    const result = await (0, worker_1.execCommand)(`powershell -Command "Get-Process '${processName}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty MainWindowTitle"`, process.cwd());
    return result.stdout.trim() || null;
}
async function handleOpenAntigravity(task) {
    const proc = (0, child_process_1.spawn)(ANTIGRAVITY_PATH, [], { detached: true, stdio: 'ignore' });
    proc.unref();
    const pid = proc.pid;
    await sleep(2000);
    const title = await getWindowTitle('Antigravity');
    return {
        status: 'opened',
        pid,
        window_title: title ?? 'Antigravity IDE',
        path: ANTIGRAVITY_PATH,
    };
}
exports.handleOpenAntigravity = handleOpenAntigravity;
// ── D3: close-antigravity ────────────────────────────────────────────────
async function handleCloseAntigravity(task) {
    await (0, worker_1.execCommand)('powershell -Command "Get-Process \'Antigravity IDE\' -ErrorAction SilentlyContinue | Stop-Process -Force"', process.cwd());
    return { status: 'closed' };
}
exports.handleCloseAntigravity = handleCloseAntigravity;
// ── D4: start-api-proxy ──────────────────────────────────────────────────
const PROXY_SCRIPT_PATH = 'E:\\Project\\Master\\Agent\\agent-coding-api-keys\\start-proxy-background.ps1';
const PROXY_LOG_FILE = 'E:\\Project\\Master\\artifact-registry\\logs\\api-proxy.log';
async function getProxyPid() {
    const r = await (0, worker_1.execCommand)('powershell -Command "(Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"', process.cwd());
    return parseInt(r.stdout.trim()) || null;
}
async function getProxyLogs(n) {
    const r = await (0, worker_1.execCommand)(`powershell -Command "Get-Content '${PROXY_LOG_FILE}' -Tail ${n} -ErrorAction SilentlyContinue"`, process.cwd());
    return r.stdout.split('\n').filter(Boolean).slice(-n);
}
async function handleStartApiProxy(task) {
    // Check if already running on port 3456
    const checkResult = await (0, worker_1.execCommand)('powershell -Command "Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"', process.cwd());
    const alreadyRunning = parseInt(checkResult.stdout.trim()) > 0;
    if (alreadyRunning) {
        const logTail = await getProxyLogs(20);
        return {
            status: 'started',
            pid: await getProxyPid(),
            port: 3456,
            log_tail: logTail,
            note: 'already_running',
        };
    }
    const proc = (0, child_process_1.spawn)('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PROXY_SCRIPT_PATH], {
        cwd: 'E:\\Project\\Master\\Agent\\agent-coding-api-keys',
        detached: true,
        stdio: 'ignore',
    });
    proc.unref();
    // Wait for the port to open
    await sleep(5000);
    const logTail = await getProxyLogs(20);
    const pid = await getProxyPid();
    return { status: 'started', pid, port: 3456, log_tail: logTail };
}
exports.handleStartApiProxy = handleStartApiProxy;
// ── D4: stop-api-proxy ───────────────────────────────────────────────────
async function handleStopApiProxy(task) {
    const pid = await getProxyPid();
    if (!pid)
        return { status: 'stopped', note: 'was not running' };
    await (0, worker_1.execCommand)(`powershell -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`, process.cwd());
    return { status: 'stopped', pid };
}
exports.handleStopApiProxy = handleStopApiProxy;
// ── D4: status-api-proxy ─────────────────────────────────────────────────
async function handleStatusApiProxy(task) {
    const pid = await getProxyPid();
    if (!pid)
        return { state: 'stopped' };
    const uptimeResult = await (0, worker_1.execCommand)(`powershell -Command "(Get-Date) - (Get-Process -Id ${pid}).StartTime | Select-Object -ExpandProperty TotalSeconds"`, process.cwd());
    const uptime_sec = Math.floor(parseFloat(uptimeResult.stdout.trim())) || 0;
    const logTail = await getProxyLogs(5);
    return { state: 'running', pid, port: 3456, uptime_sec, log_tail: logTail };
}
exports.handleStatusApiProxy = handleStatusApiProxy;
//# sourceMappingURL=commands.handler.js.map