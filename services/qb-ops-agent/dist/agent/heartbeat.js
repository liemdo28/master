"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendHeartbeat = void 0;
const agent_os_client_1 = require("../api/agent-os-client");
const dashboard_client_1 = require("../api/dashboard-client");
const machine_id_1 = require("./machine-id");
const detector_1 = require("../quickbooks/detector");
const local_db_1 = require("../storage/local-db");
const logs_1 = require("../storage/logs");
async function sendHeartbeat(identity) {
    const qb = (0, detector_1.detectQuickBooksStatus)();
    (0, machine_id_1.updateMachineQuickBooksVersion)(qb.version);
    const payload = {
        agent: process.env.AGENT_NAME || 'qb-ops-agent',
        machine_id: identity.machine_id,
        hostname: identity.hostname,
        status: 'online',
        quickbooks: {
            installed: qb.installed,
            running: qb.running,
            version: qb.version,
        },
        timestamp: new Date().toISOString(),
    };
    const agentOs = new agent_os_client_1.AgentOsClient(identity.token);
    const dashboard = new dashboard_client_1.DashboardClient(identity.token);
    try {
        await agentOs.sendHeartbeat(payload);
    }
    catch {
        // queued by AgentOsClient
    }
    await dashboard.sendMachineStatus({
        agent: payload.agent,
        machine_id: payload.machine_id,
        hostname: payload.hostname,
        online: true,
        quickbooks_installed: payload.quickbooks.installed,
        quickbooks_running: payload.quickbooks.running,
        quickbooks_version: payload.quickbooks.version,
        heartbeat_at: payload.timestamp,
    });
    logs_1.logger.info('Heartbeat cycle complete', {
        machine_id: identity.machine_id,
        queue_depth: (0, local_db_1.getQueueDepth)(),
    });
    return payload;
}
exports.sendHeartbeat = sendHeartbeat;
//# sourceMappingURL=heartbeat.js.map