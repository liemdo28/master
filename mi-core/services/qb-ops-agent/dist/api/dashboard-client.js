"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardClient = void 0;
const axios_1 = __importDefault(require("axios"));
const logs_1 = require("../storage/logs");
const baseURL = process.env.DASHBOARD_API_URL || 'https://dashboard.bakudanramen.com/api';
class DashboardClient {
    constructor(machineToken) {
        this.http = axios_1.default.create({
            baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${machineToken}`,
            },
        });
    }
    async sendMachineStatus(payload) {
        try {
            await this.http.post('/accounting-ops/qb-machines/status', payload);
            logs_1.logger.info('Dashboard machine status prepared/sent', { machine_id: payload.machine_id, online: payload.online });
        }
        catch (error) {
            logs_1.logger.warn('Dashboard machine status send failed', {
                machine_id: payload.machine_id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async sendWorkflowStatus(payload) {
        try {
            await this.http.post('/accounting-ops/qb-workflows/status', payload);
            logs_1.logger.info('Dashboard workflow status prepared/sent', {
                machine_id: payload.machine_id,
                workflow: payload.workflow,
                status: payload.status,
            });
        }
        catch (error) {
            logs_1.logger.warn('Dashboard workflow status send failed', {
                machine_id: payload.machine_id,
                workflow: payload.workflow,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
exports.DashboardClient = DashboardClient;
//# sourceMappingURL=dashboard-client.js.map