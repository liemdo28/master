"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onShutdown = exports.onStartup = void 0;
const logs_1 = require("../storage/logs");
async function onStartup() {
    logs_1.logger.info('qb-ops-agent starting up', {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
        uptime: process.uptime(),
    });
}
exports.onStartup = onStartup;
async function onShutdown() {
    logs_1.logger.info('qb-ops-agent shutting down gracefully', { uptime: process.uptime() });
}
exports.onShutdown = onShutdown;
//# sourceMappingURL=startup.js.map