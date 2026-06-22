"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logDir = process.env.LOG_DIR || './logs';
const logLevel = process.env.LOG_LEVEL || 'info';
// Ensure log directory exists
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    // SECURITY: Never log sensitive financial data or credentials
    const safeMeta = sanitizeLogMeta(meta);
    const metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
}));
/**
 * Strip sensitive fields from log metadata.
 * Never logs passwords, tokens, transaction amounts, or account numbers.
 */
function sanitizeLogMeta(meta) {
    const SENSITIVE_KEYS = [
        'password', 'passwd', 'token', 'secret', 'credential',
        'ssn', 'account_number', 'card_number', 'cvv', 'routing_number',
        'amount', 'balance', 'transaction_id',
    ];
    const result = {};
    for (const [key, value] of Object.entries(meta)) {
        if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
            result[key] = '[REDACTED]';
        }
        else if (value && typeof value === 'object') {
            result[key] = sanitizeLogMeta(value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
exports.logger = winston_1.default.createLogger({
    level: logLevel,
    format: logFormat,
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), logFormat),
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'agent.log'),
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
            tailable: true,
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});
exports.default = exports.logger;
//# sourceMappingURL=logs.js.map