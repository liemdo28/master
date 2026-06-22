export interface HeartbeatPayload {
    agent: string;
    machine_id: string;
    hostname: string;
    status: 'online' | 'offline';
    quickbooks: {
        installed: boolean;
        running: boolean;
        version: string | null;
    };
    timestamp: string;
}
export interface WorkflowActionResult {
    name: string;
    status: 'done' | 'missing' | 'failed' | 'needs_user';
    message: string;
    timestamp: string;
}
export interface WorkflowResultPayload {
    agent: string;
    machine_id: string;
    company_file: string;
    workflow: string;
    status: 'success' | 'warning' | 'failed' | 'needs_user';
    actions: WorkflowActionResult[];
}
export declare class AgentOsClient {
    private readonly http;
    private readonly agentName;
    private readonly machineToken;
    constructor(machineToken: string);
    sendHeartbeat(payload: HeartbeatPayload): Promise<void>;
    sendWorkflowResult(payload: WorkflowResultPayload): Promise<void>;
    flushQueue(): Promise<void>;
}
//# sourceMappingURL=agent-os-client.d.ts.map