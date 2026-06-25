"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const qbwc_server_1 = require("./soap/qbwc-server");
const startup_1 = require("./agent/startup");
const machine_id_1 = require("./agent/machine-id");
const heartbeat_1 = require("./agent/heartbeat");
const company_files_1 = require("./quickbooks/company-files");
const workflows_1 = require("./quickbooks/workflows");
const agent_os_client_1 = require("./api/agent-os-client");
const dashboard_client_1 = require("./api/dashboard-client");
const local_db_1 = require("./storage/local-db");
const logs_1 = require("./storage/logs");
const HEARTBEAT_INTERVAL_MS = (parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS || '60', 10)) * 1000;
const WORKFLOW_INTERVAL_MS = (parseInt(process.env.WORKFLOW_CHECK_INTERVAL_MINUTES || '15', 10)) * 60 * 1000;
const COMMAND_POLL_INTERVAL_MS = (parseInt(process.env.COMMAND_POLL_INTERVAL_SECONDS || '60', 10)) * 1000;
const MI_CORE_URL = process.env.MI_CORE_URL || 'http://localhost:4001';
const MI_CORE_API_KEY = process.env.MI_CORE_API_KEY || '';
const MACHINE_ID = process.env.MACHINE_ID || 'qb-laptop-01';
let heartbeatTimer = null;
let workflowTimer = null;
let commandPollTimer = null;
let isShuttingDown = false;
async function heartbeatCycle() {
    if (isShuttingDown)
        return;
    try {
        const identity = (0, machine_id_1.getMachineIdentity)();
        await (0, heartbeat_1.sendHeartbeat)(identity);
    }
    catch (err) {
        logs_1.logger.error('Heartbeat cycle failed', { error: err instanceof Error ? err.message : String(err) });
    }
}
async function workflowCycle() {
    if (isShuttingDown)
        return;
    try {
        const identity = (0, machine_id_1.getMachineIdentity)();
        (0, company_files_1.syncConfiguredCompanyFiles)(identity.machine_id);
        const companyFiles = (0, company_files_1.getTrackedCompanyFiles)(identity.machine_id);
        if (!companyFiles.length) {
            logs_1.logger.info('No company files configured — skipping workflow cycle');
            return;
        }
        for (const cf of companyFiles) {
            const runId = (0, local_db_1.insertWorkflowRun)({
                workflow_name: 'all_phase1',
                company_file_id: cf.company_file_id,
                machine_id: identity.machine_id,
                status: 'running',
                started_at: new Date().toISOString(),
            });
            let overallStatus = 'success';
            const allActions = [];
            try {
                const results = await (0, workflows_1.runAllPhase1Workflows)(cf);
                for (const result of results) {
                    if (result.status === 'failed')
                        overallStatus = 'failed';
                    else if (result.status === 'warning' && overallStatus !== 'failed')
                        overallStatus = 'warning';
                    else if (result.status === 'needs_user' && overallStatus === 'success')
                        overallStatus = 'needs_user';
                    for (const action of result.actions) {
                        allActions.push(action);
                        (0, local_db_1.logAction)({
                            machine_id: identity.machine_id,
                            workflow: result.workflow,
                            action_name: action.name,
                            status: action.status,
                            message: action.message,
                            created_at: action.timestamp,
                        });
                    }
                    const agentOs = new agent_os_client_1.AgentOsClient(identity.token);
                    const wfPayload = {
                        agent: process.env.AGENT_NAME || 'qb-ops-agent',
                        machine_id: identity.machine_id,
                        company_file: result.company_file,
                        workflow: result.workflow,
                        status: result.status,
                        actions: result.actions,
                    };
                    await agentOs.sendWorkflowResult(wfPayload).catch(() => { });
                    const dashboard = new dashboard_client_1.DashboardClient(identity.token);
                    await dashboard.sendWorkflowStatus({
                        agent: process.env.AGENT_NAME || 'qb-ops-agent',
                        machine_id: identity.machine_id,
                        company_file_id: cf.company_file_id,
                        company_name: cf.company_name,
                        company_file_path: cf.company_file_path,
                        workflow: result.workflow,
                        status: result.status,
                        last_check_at: new Date().toISOString(),
                        action_required: result.status === 'needs_user' || result.status === 'failed',
                        summary: result.actions.map(a => a.message).join(' | '),
                    }).catch(() => { });
                }
            }
            catch (err) {
                overallStatus = 'failed';
                logs_1.logger.error('Workflow cycle failed for company file', {
                    company_file: cf.company_file_path,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            (0, local_db_1.completeWorkflowRun)(runId, overallStatus, `${overallStatus}: ${allActions.length} actions`, JSON.stringify(allActions));
            logs_1.logger.info('Workflow cycle complete for company file', {
                company_file: cf.company_file_path,
                status: overallStatus,
                actions: allActions.length,
            });
        }
        // Flush queued items
        const agentOs = new agent_os_client_1.AgentOsClient(identity.token);
        await agentOs.flushQueue().catch(() => { });
    }
    catch (err) {
        logs_1.logger.error('Workflow cycle failed', { error: err instanceof Error ? err.message : String(err) });
    }
}
async function miCoreFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (MI_CORE_API_KEY)
        headers['X-API-Key'] = MI_CORE_API_KEY;
    return fetch(`${MI_CORE_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}
async function executeTriggerSync(cmd) {
    const identity = (0, machine_id_1.getMachineIdentity)();
    const companyFiles = (0, company_files_1.getTrackedCompanyFiles)(identity.machine_id);
    if (!companyFiles.length) {
        logs_1.logger.warn('[CMD] TRIGGER_SYNC: no company files configured, skipping');
        return;
    }
    logs_1.logger.info('[CMD] TRIGGER_SYNC: starting forced sync', { command_id: cmd.command_id, files: companyFiles.length });
    await workflowCycle();
    logs_1.logger.info('[CMD] TRIGGER_SYNC: done', { command_id: cmd.command_id });
}
async function commandPollCycle() {
    if (isShuttingDown)
        return;
    try {
        const res = await miCoreFetch(`/api/qb-agent/commands?machine_id=${encodeURIComponent(MACHINE_ID)}`);
        if (!res.ok) {
            logs_1.logger.warn('[CMD] Poll failed', { status: res.status });
            return;
        }
        const { commands } = await res.json();
        if (!commands?.length)
            return;
        for (const cmd of commands) {
            logs_1.logger.info('[CMD] Processing command', { command_id: cmd.command_id, type: cmd.command_type });
            // Ack first so we don't re-process on next poll
            await miCoreFetch(`/api/qb-agent/commands/${cmd.command_id}/ack`, { method: 'POST' }).catch(() => { });
            try {
                if (cmd.command_type === 'TRIGGER_SYNC') {
                    await executeTriggerSync(cmd);
                    await miCoreFetch(`/api/qb-agent/commands/${cmd.command_id}/result`, {
                        method: 'POST',
                        body: JSON.stringify({ status: 'completed', result: { triggered_by: 'qb-ops-agent', ts: new Date().toISOString() } }),
                    });
                }
                else {
                    logs_1.logger.warn('[CMD] Unknown command type — skipping', { type: cmd.command_type });
                    await miCoreFetch(`/api/qb-agent/commands/${cmd.command_id}/result`, {
                        method: 'POST',
                        body: JSON.stringify({ status: 'error', error: `unknown command type: ${cmd.command_type}` }),
                    });
                }
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logs_1.logger.error('[CMD] Command execution failed', { command_id: cmd.command_id, error: message });
                await miCoreFetch(`/api/qb-agent/commands/${cmd.command_id}/result`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'error', error: message }),
                }).catch(() => { });
            }
        }
    }
    catch (err) {
        logs_1.logger.error('[CMD] Command poll error', { error: err instanceof Error ? err.message : String(err) });
    }
}
async function main() {
    await (0, startup_1.onStartup)();
    // Start QBWC SOAP server (port 3457)
    (0, qbwc_server_1.startQbwcServer)();
    // Initial runs
    await heartbeatCycle();
    await workflowCycle();
    await commandPollCycle();
    // Schedule recurring
    heartbeatTimer = setInterval(heartbeatCycle, HEARTBEAT_INTERVAL_MS);
    workflowTimer = setInterval(workflowCycle, WORKFLOW_INTERVAL_MS);
    commandPollTimer = setInterval(commandPollCycle, COMMAND_POLL_INTERVAL_MS);
    logs_1.logger.info('qb-ops-agent running', {
        heartbeatInterval: HEARTBEAT_INTERVAL_MS,
        workflowInterval: WORKFLOW_INTERVAL_MS,
        commandPollInterval: COMMAND_POLL_INTERVAL_MS,
        miCoreUrl: MI_CORE_URL,
        machineId: MACHINE_ID,
    });
}
process.on('SIGINT', async () => {
    logs_1.logger.info('Received SIGINT');
    isShuttingDown = true;
    if (heartbeatTimer)
        clearInterval(heartbeatTimer);
    if (workflowTimer)
        clearInterval(workflowTimer);
    if (commandPollTimer)
        clearInterval(commandPollTimer);
    await (0, startup_1.onShutdown)();
    (0, local_db_1.closeDb)();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logs_1.logger.info('Received SIGTERM');
    isShuttingDown = true;
    if (heartbeatTimer)
        clearInterval(heartbeatTimer);
    if (workflowTimer)
        clearInterval(workflowTimer);
    await (0, startup_1.onShutdown)();
    (0, local_db_1.closeDb)();
    process.exit(0);
});
process.on('uncaughtException', (err) => {
    logs_1.logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    (0, local_db_1.closeDb)();
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logs_1.logger.error('Unhandled rejection', { reason });
    (0, local_db_1.closeDb)();
    process.exit(1);
});
main().catch((err) => {
    logs_1.logger.error('Fatal startup error', { error: err instanceof Error ? err.message : String(err) });
    (0, local_db_1.closeDb)();
    process.exit(1);
});
//# sourceMappingURL=index.js.map