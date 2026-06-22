"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllPhase1Workflows = void 0;
const bank_feed_check_1 = require("../workflows/bank-feed-check");
const cc_expense_check_1 = require("../workflows/cc-expense-check");
const daily_accounting_check_1 = require("../workflows/daily-accounting-check");
const reconcile_check_1 = require("../workflows/reconcile-check");
const sales_receipt_check_1 = require("../workflows/sales-receipt-check");
async function runAllPhase1Workflows(companyFile) {
    return [
        await (0, daily_accounting_check_1.runDailyAccountingCheck)(companyFile),
        await (0, sales_receipt_check_1.runSalesReceiptCheck)(companyFile),
        await (0, bank_feed_check_1.runBankFeedCheck)(companyFile),
        await (0, reconcile_check_1.runReconcileCheck)(companyFile),
        await (0, cc_expense_check_1.runCcExpenseCheck)(companyFile),
        {
            workflow: 'sync_error_queue_check',
            company_file: companyFile.company_file_path,
            status: 'success',
            actions: [
                {
                    name: 'sync_error_queue_check',
                    status: 'done',
                    message: 'Outbound sync queue is monitored locally in Phase 1.',
                    timestamp: new Date().toISOString(),
                },
            ],
        },
    ];
}
exports.runAllPhase1Workflows = runAllPhase1Workflows;
//# sourceMappingURL=workflows.js.map