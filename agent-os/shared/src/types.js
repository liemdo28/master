"use strict";
// ============================================================
// Agent OS - Shared Types
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsMessageType = exports.WorkerStatus = exports.TaskPriority = exports.TaskType = exports.TaskStatus = void 0;
// Task Status
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["WAITING_APPROVAL"] = "waiting_approval";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
// Task Types
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
})(TaskType || (exports.TaskType = TaskType = {}));
// Task Priority
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
    TaskPriority["CRITICAL"] = "critical";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
// Worker Status
var WorkerStatus;
(function (WorkerStatus) {
    WorkerStatus["ONLINE"] = "online";
    WorkerStatus["OFFLINE"] = "offline";
    WorkerStatus["BUSY"] = "busy";
    WorkerStatus["ERROR"] = "error";
})(WorkerStatus || (exports.WorkerStatus = WorkerStatus = {}));
// WebSocket Message Types
var WsMessageType;
(function (WsMessageType) {
    WsMessageType["LOG"] = "log";
    WsMessageType["TASK_UPDATE"] = "task_update";
    WsMessageType["WORKER_UPDATE"] = "worker_update";
    WsMessageType["HEARTBEAT"] = "heartbeat";
    WsMessageType["TASK_ASSIGN"] = "task_assign";
    WsMessageType["TASK_RESULT"] = "task_result";
})(WsMessageType || (exports.WsMessageType = WsMessageType = {}));
//# sourceMappingURL=types.js.map