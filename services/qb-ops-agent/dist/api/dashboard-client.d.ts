export interface DashboardMachineStatusPayload {
    agent: string;
    machine_id: string;
    hostname: string;
    online: boolean;
    quickbooks_installed: boolean;
    quickbooks_running: boolean;
    quickbooks_version: string | null;
    heartbeat_at: string;
}
export interface DashboardWorkflowStatusPayload {
    agent: string;
    machine_id: string;
    company_file_id: string;
    company_name: string | null;
    company_file_path: string;
    workflow: string;
    status: string;
    last_check_at: string;
    action_required: boolean;
    summary: string;
}
export declare class DashboardClient {
    private readonly http;
    constructor(machineToken: string);
    sendMachineStatus(payload: DashboardMachineStatusPayload): Promise<void>;
    sendWorkflowStatus(payload: DashboardWorkflowStatusPayload): Promise<void>;
}
//# sourceMappingURL=dashboard-client.d.ts.map