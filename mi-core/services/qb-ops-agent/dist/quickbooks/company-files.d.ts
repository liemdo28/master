import { CompanyFileRecord } from '../storage/local-db';
export interface ConfiguredCompanyFile {
    company_file_id: string;
    company_name: string | null;
    company_file_path: string;
    assigned_store: string | null;
    assigned_department: string | null;
    notes: string | null;
}
export declare function loadConfiguredCompanyFiles(): ConfiguredCompanyFile[];
export declare function syncConfiguredCompanyFiles(machineId: string): CompanyFileRecord[];
export declare function addConfiguredCompanyFile(machineId: string, filePath: string, companyName?: string): ConfiguredCompanyFile;
export declare function getTrackedCompanyFiles(machineId: string): CompanyFileRecord[];
//# sourceMappingURL=company-files.d.ts.map