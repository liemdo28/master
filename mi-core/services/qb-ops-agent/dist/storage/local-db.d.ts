import sqlite3 from 'sqlite3';
export declare function getDb(): sqlite3.Database;
export interface MachineRecord {
    machine_id: string;
    hostname: string;
    windows_username: string | null;
    os_version: string | null;
    ip_address: string | null;
    agent_version: string;
    quickbooks_version: string | null;
    registered_at: string;
    last_seen_at: string;
    status: string;
}
export declare function upsertMachine(m: MachineRecord): void;
export declare function getMachine(machineId: string): MachineRecord | undefined;
export interface CompanyFileRecord {
    company_file_id: string;
    company_name: string | null;
    company_file_path: string;
    last_opened_at: string | null;
    last_checked_at: string | null;
    status: string;
    assigned_store: string | null;
    assigned_department: string | null;
    notes: string | null;
    machine_id: string;
    created_at: string;
    updated_at: string;
}
export declare function upsertCompanyFile(f: CompanyFileRecord): void;
export declare function getCompanyFiles(_machineId?: string): CompanyFileRecord[];
export interface WorkflowRunRecord {
    workflow_name: string;
    company_file_id: string | null;
    machine_id: string;
    status: string;
    started_at: string;
    completed_at?: string | null;
    summary?: string | null;
    actions_json?: string | null;
}
export declare function insertWorkflowRun(r: WorkflowRunRecord): number;
export declare function completeWorkflowRun(id: number, status: string, summary: string, actionsJson: string): void;
export interface ActionLogRecord {
    machine_id: string;
    workflow: string | null;
    action_name: string;
    status: string;
    message: string | null;
    created_at: string;
}
export declare function logAction(a: ActionLogRecord): void;
export interface QueueItem {
    id: number;
    payload: string;
    endpoint: string;
    attempts: number;
    max_attempts: number;
    created_at: string;
    last_attempt_at: string | null;
    error: string | null;
}
export declare function enqueueOutbound(payload: object, endpoint: string): number;
export declare function getQueuedItems(_limit?: number): QueueItem[];
export declare function markQueueItemAttempted(id: number, error: string | null): void;
export declare function removeFromQueue(id: number): void;
export declare function getQueueDepth(): number;
export declare function getSetting(key: string): string | null;
export declare function setSetting(key: string, value: string): void;
export declare function closeDb(): void;
//# sourceMappingURL=local-db.d.ts.map