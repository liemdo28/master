interface SyncStatus {
    last_sync: string | null;
    last_company_file: string | null;
    requests_received: number;
    total_bytes: number;
    error: string | null;
}
export declare function storeQbData(requestIndex: number, companyFile: string, xmlResponse: string): void;
export declare function getLastSyncStatus(): SyncStatus;
export interface FinancialSummary {
    last_sync: string | null;
    last_company_file: string | null;
    requests_received: number;
    accounts: {
        name: string;
        type: string;
        balance: number;
    }[];
    total_income: number;
    total_expense: number;
    net_income: number;
    sales_receipts_30d: {
        date: string;
        total: number;
        customer: string;
    }[];
    total_sales_30d: number;
    invoices_30d: {
        date: string;
        total: number;
        customer: string;
        status: string;
    }[];
    total_invoices_30d: number;
    outstanding_invoices: number;
    transaction_count: number;
}
export declare function parseFinancialSummary(): FinancialSummary;
export {};
//# sourceMappingURL=qb-data-store.d.ts.map