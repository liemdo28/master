"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMachineQuickBooksVersion = exports.getMachineId = exports.getMachineIdentity = void 0;
const os_1 = __importDefault(require("os"));
const node_machine_id_1 = require("node-machine-id");
const uuid_1 = require("uuid");
const token_1 = require("../security/token");
const local_db_1 = require("../storage/local-db");
const MACHINE_NAMESPACE = '9d6d6c9a-6c96-4935-b67d-96795f2b63a7';
const AGENT_VERSION = '1.0.0';
function detectPrimaryIp() {
    const interfaces = os_1.default.networkInterfaces();
    for (const net of Object.values(interfaces)) {
        if (!net)
            continue;
        for (const iface of net) {
            if (iface.family === 'IPv4' && !iface.internal)
                return iface.address;
        }
    }
    return null;
}
function getMachineIdentity() {
    const saved = (0, local_db_1.getSetting)('machine_id');
    const hostname = os_1.default.hostname();
    const username = process.env.USERNAME || process.env.USER || null;
    const rawMachineId = (0, node_machine_id_1.machineIdSync)(true);
    const stableMachineId = saved || (0, uuid_1.v5)(`${hostname}:${rawMachineId}`, MACHINE_NAMESPACE);
    if (!saved)
        (0, local_db_1.setSetting)('machine_id', stableMachineId);
    const token = (0, token_1.getOrCreateMachineToken)();
    const identity = {
        machine_id: stableMachineId,
        hostname,
        windows_username: username,
        os_version: `${os_1.default.type()} ${os_1.default.release()}`,
        ip_address: detectPrimaryIp(),
        agent_version: AGENT_VERSION,
        token,
    };
    const now = new Date().toISOString();
    const machineRecord = {
        machine_id: identity.machine_id,
        hostname: identity.hostname,
        windows_username: identity.windows_username,
        os_version: identity.os_version,
        ip_address: identity.ip_address,
        agent_version: identity.agent_version,
        quickbooks_version: null,
        registered_at: (0, local_db_1.getSetting)('registered_at') || now,
        last_seen_at: now,
        status: 'online',
    };
    if (!(0, local_db_1.getSetting)('registered_at'))
        (0, local_db_1.setSetting)('registered_at', now);
    (0, local_db_1.upsertMachine)(machineRecord);
    return identity;
}
exports.getMachineIdentity = getMachineIdentity;
function getMachineId() {
    return getMachineIdentity().machine_id;
}
exports.getMachineId = getMachineId;
function updateMachineQuickBooksVersion(version) {
    const identity = getMachineIdentity();
    const registeredAt = (0, local_db_1.getSetting)('registered_at') || new Date().toISOString();
    (0, local_db_1.upsertMachine)({
        machine_id: identity.machine_id,
        hostname: identity.hostname,
        windows_username: identity.windows_username,
        os_version: identity.os_version,
        ip_address: identity.ip_address,
        agent_version: identity.agent_version,
        quickbooks_version: version,
        registered_at: registeredAt,
        last_seen_at: new Date().toISOString(),
        status: 'online',
    });
}
exports.updateMachineQuickBooksVersion = updateMachineQuickBooksVersion;
//# sourceMappingURL=machine-id.js.map