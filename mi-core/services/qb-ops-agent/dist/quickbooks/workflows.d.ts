import { CompanyFileRecord } from '../storage/local-db';
export interface WorkflowAction {
    name: string;
    status: 'done' | 'missing' | 'failed' | 'needs_user';
    message: string;
    timestamp: string;
}
export interface WorkflowResult {
    workflow: string;
    company_file: string;
    status: 'success' | 'warning' | 'failed' | 'needs_user';
    actions: WorkflowAction[];
}
export declare function runAllPhase1Workflows(companyFile: CompanyFileRecord): Promise<WorkflowResult[]>;
//# sourceMappingURL=workflows.d.ts.map