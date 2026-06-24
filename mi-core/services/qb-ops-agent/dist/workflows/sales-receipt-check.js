"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSalesReceiptCheck = void 0;
async function runSalesReceiptCheck(companyFile) {
    return {
        workflow: 'sales_receipt_check',
        company_file: companyFile.company_file_path,
        status: 'warning',
        actions: [
            {
                name: 'sales_receipt_check',
                status: 'needs_user',
                message: 'Sales receipt verification requires manual review or future QBSDK read-only integration.',
                timestamp: new Date().toISOString(),
            },
        ],
    };
}
exports.runSalesReceiptCheck = runSalesReceiptCheck;
//# sourceMappingURL=sales-receipt-check.js.map