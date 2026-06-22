"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOsClient = void 0;
const axios_1 = __importDefault(require("axios"));
const logs_1 = require("../storage/logs");
const local_db_1 = require("../storage/local-db");
const baseURL = process.env.AGENT_OS_API_URL || 'http://127.0.0.1:3456/api';
class AgentOsClient {
    constructor(machineToken) {
        this.machineToken = machineToken;
        this.agentName = process.env.AGENT_NAME || 'qb-ops-agent';
        this.http = axios_1.default.create({
            baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'X-Agent-Name': this.agentName,
                'Authorization': `Bearer ${machineToken}`,
            },
        });
    }
    async sendHeartbeat(payload) {
        try {
            await this.http.post('/agents/heartbeat', payload);
            logs_1.logger.info('Heartbeat sent to Agent OS', { machine_id: payload.machine_id, status: payload.status });
        }
        catch (error) {
            logs_1.logger.warn('Failed to send heartbeat to Agent OS, queueing for retry', {
                machine_id: payload.machine_id,
                error: error instanceof Error ? error.message : String(error),
            });
            (0, local_db_1.enqueueOutbound)(payload, '/agents/heartbeat');
            throw error;
        }
    }
    async sendWorkflowResult(payload) {
        try {
            await this.http.post('/agents/workflow-result', payload);
            logs_1.logger.info('Workflow result sent to Agent OS', {
                machine_id: payload.machine_id,
                workflow: payload.workflow,
                status: payload.status,
            });
        }
        catch (error) {
            logs_1.logger.warn('Failed to send workflow result to Agent OS, queueing for retry', {
                machine_id: payload.machine_id,
                workflow: payload.workflow,
                error: error instanceof Error ? error.message : String(error),
            });
            (0, local_db_1.enqueueOutbound)(payload, '/agents/workflow-result');
            throw error;
        }
    }
    async flushQueue() {
        const items = (0, local_db_1.getQueuedItems)(50);
        if (!items.length)
            return;
        logs_1.logger.info('Flushing outbound queue', { queuedItems: items.length });
        for (const item of items) {
            try {
                await this.http.post(item.endpoint, JSON.parse(item.payload));
                (0, local_db_1.removeFromQueue)(item.id);
                logs_1.logger.info('Queued payload delivered successfully', { queueId: item.id, endpoint: item.endpoint });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                (0, local_db_1.markQueueItemAttempted)(item.id, message);
                logs_1.logger.warn('Queued payload delivery failed', { queueId: item.id, endpoint: item.endpoint, error: message });
            }
        }
    }
}
exports.AgentOsClient = AgentOsClient;
//# sourceMappingURL=agent-os-client.js.map