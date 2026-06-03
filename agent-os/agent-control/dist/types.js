"use strict";
// Local control-plane task types. Kept inside src so the control build does not
// compile files outside rootDir.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEARTBEAT_INTERVAL_MS = exports.TaskPriority = exports.TaskType = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["WAITING_APPROVAL"] = "waiting_approval";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskType;
(function (TaskType) {
    TaskType["BUILD"] = "build";
    TaskType["QA"] = "qa";
    TaskType["GIT_SYNC"] = "git_sync";
    TaskType["AUDIT"] = "audit";
    TaskType["SCRIPT"] = "script";
    TaskType["CLINE"] = "cline";
    TaskType["DEPLOY"] = "deploy";
    TaskType["LAUNCH"] = "launch";
    TaskType["CLOUD"] = "cloud";
    // D2-D6 control plane commands
    TaskType["PING"] = "ping";
    TaskType["SHELL"] = "shell";
    TaskType["OPEN_ANTIGRAVITY"] = "open-antigravity";
    TaskType["CLOSE_ANTIGRAVITY"] = "close-antigravity";
    TaskType["START_API_PROXY"] = "start-api-proxy";
    TaskType["STOP_API_PROXY"] = "stop-api-proxy";
    TaskType["STATUS_API_PROXY"] = "status-api-proxy";
    TaskType["CLINE_PROMPT"] = "cline-prompt";
    TaskType["RUN_SCRIPT"] = "run-script";
    TaskType["FETCH_FILE"] = "fetch-file";
    TaskType["START_SERVICE"] = "start-service";
    TaskType["STOP_SERVICE"] = "stop-service";
    TaskType["STATUS_SERVICE"] = "status-service";
})(TaskType || (exports.TaskType = TaskType = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
    TaskPriority["CRITICAL"] = "critical";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
exports.HEARTBEAT_INTERVAL_MS = 5000;
//# sourceMappingURL=types.js.map