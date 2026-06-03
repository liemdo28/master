"use strict";
// ============================================================
// Agent OS - Control Plane - Intent Engine
// Converts natural language commands into structured task objects
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
exports.getUnsupportedCommandMessage = exports.describeIntent = exports.parseIntent = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("../types");
function getRegistryPath() {
    const candidates = [
        path.resolve(process.cwd(), '..', 'COMMAND_REGISTRY.json'),
        path.resolve(process.cwd(), 'COMMAND_REGISTRY.json'),
        path.resolve(__dirname, '..', '..', '..', 'COMMAND_REGISTRY.json'),
    ];
    const found = candidates.find(candidate => fs.existsSync(candidate));
    if (!found) {
        throw new Error(`COMMAND_REGISTRY.json not found. Checked: ${candidates.join(', ')}`);
    }
    return found;
}
function loadRegistry() {
    const raw = fs.readFileSync(getRegistryPath(), 'utf-8');
    return JSON.parse(raw);
}
function normalizeMessage(message) {
    return message.trim().toLowerCase().replace(/\s+/g, ' ');
}
function toTaskType(taskType) {
    if (taskType === 'query')
        return 'query';
    if (Object.values(types_1.TaskType).includes(taskType))
        return taskType;
    throw new Error(`Unsupported task_type in command registry: ${taskType}`);
}
/**
 * Parse a natural language message into a structured intent
 */
function parseIntent(message) {
    const trimmed = message.trim();
    const normalized = normalizeMessage(trimmed);
    const registry = loadRegistry();
    const command = registry.commands.find(entry => entry.aliases.some(alias => normalizeMessage(alias) === normalized));
    if (!command) {
        return {
            supported: false,
            intent: 'unsupported',
            type: 'query',
            project: 'E:\\Project\\Master',
            priority: extractPriority(normalized),
            payload: { originalMessage: trimmed },
            requiresApproval: false,
            riskLevel: 'safe',
            originalMessage: trimmed,
            unsupportedReason: 'Message did not match COMMAND_REGISTRY.json.',
            suggestions: registry.unsupported_suggestions,
        };
    }
    const type = toTaskType(command.task_type);
    const payload = {
        ...(command.payload || {}),
        registryIntent: command.intent,
        executor: command.executor,
        originalMessage: trimmed,
    };
    return {
        supported: true,
        intent: command.intent,
        displayName: command.display_name,
        type,
        executor: command.executor,
        project: command.project,
        priority: extractPriority(normalized),
        payload,
        requiresApproval: command.approval_required,
        riskLevel: command.risk_level,
        originalMessage: trimmed,
    };
}
exports.parseIntent = parseIntent;
/**
 * Extract priority from message context
 */
function extractPriority(message) {
    if (/urgent|asap|immediately|critical|now/i.test(message))
        return types_1.TaskPriority.CRITICAL;
    if (/high|important|priority/i.test(message))
        return types_1.TaskPriority.HIGH;
    if (/low|when.*free|later/i.test(message))
        return types_1.TaskPriority.LOW;
    return types_1.TaskPriority.MEDIUM;
}
/**
 * Get a human-readable description of the parsed intent
 */
function describeIntent(intent) {
    if (!intent.supported)
        return 'Unsupported command';
    const riskEmoji = {
        safe: '✅',
        elevated: '⚠️',
        dangerous: '🔴',
        critical: '⛔',
    };
    return `${riskEmoji[intent.riskLevel]} ${intent.displayName || intent.intent} -> ${intent.executor} -> ${intent.project}${intent.requiresApproval ? ' (requires approval)' : ''}`;
}
exports.describeIntent = describeIntent;
function getUnsupportedCommandMessage(suggestions) {
    const list = suggestions && suggestions.length > 0
        ? suggestions
        : loadRegistry().unsupported_suggestions;
    return [
        'I received your message, but it is not a supported command yet.',
        '',
        'Try:',
        ...list.map(item => `- ${item}`),
    ].join('\n');
}
exports.getUnsupportedCommandMessage = getUnsupportedCommandMessage;
//# sourceMappingURL=intentEngine.js.map