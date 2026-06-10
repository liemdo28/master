"use strict";
/**
 * Mi Approval Gate — Level 1/2/3 action queue.
 * Level 1: auto-allowed (read, scan, report)
 * Level 2: requires single approval (write, create, assign)
 * Level 3: requires double approval (delete, deploy, push, financial)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gateEvents = void 0;
exports.isAutoAllowed = isAutoAllowed;
exports.enqueue = enqueue;
exports.approve = approve;
exports.reject = reject;
exports.markExecuted = markExecuted;
exports.getPending = getPending;
exports.getAll = getAll;
exports.getById = getById;
const uuid_1 = require("uuid");
const events_1 = require("events");
// In-memory queue (persisted to file in production)
const queue = new Map();
exports.gateEvents = new events_1.EventEmitter();
// Level 1 categories — auto-allowed, no queue needed
const LEVEL1_CATEGORIES = new Set([
    'read_file', 'search_file', 'scan_project', 'map_source',
    'query_knowledge', 'pull_dashboard', 'pull_website',
    'generate_report', 'generate_draft', 'generate_patch_proposal', 'run_qa',
    'list_processes', 'check_port', 'read_log',
]);
function isAutoAllowed(category) {
    return LEVEL1_CATEGORIES.has(category);
}
function enqueue(params) {
    const action = {
        id: (0, uuid_1.v4)(),
        created_at: new Date().toISOString(),
        status: 'pending',
        confirmations: 0,
        ...params,
    };
    queue.set(action.id, action);
    exports.gateEvents.emit('new_action', action);
    return action;
}
function approve(id, approver = 'owner') {
    const action = queue.get(id);
    if (!action || action.status !== 'pending')
        return null;
    action.confirmations += 1;
    if (action.risk_level === 3 && action.confirmations < 2) {
        // Level 3: needs a second confirmation
        exports.gateEvents.emit('partial_approval', action);
        return action;
    }
    action.status = 'approved';
    action.resolved_at = new Date().toISOString();
    action.resolved_by = approver;
    exports.gateEvents.emit('approved', action);
    return action;
}
function reject(id, approver = 'owner') {
    const action = queue.get(id);
    if (!action || action.status !== 'pending')
        return null;
    action.status = 'rejected';
    action.resolved_at = new Date().toISOString();
    action.resolved_by = approver;
    exports.gateEvents.emit('rejected', action);
    return action;
}
function markExecuted(id, result) {
    const action = queue.get(id);
    if (!action)
        return;
    action.status = 'executed';
    action.result = result;
}
function getPending() {
    return [...queue.values()].filter(a => a.status === 'pending');
}
function getAll() {
    return [...queue.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
function getById(id) {
    return queue.get(id);
}
