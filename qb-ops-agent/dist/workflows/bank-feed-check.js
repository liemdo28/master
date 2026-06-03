"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBankFeedCheck = void 0;
async function runBankFeedCheck(companyFile) {
    return {
        workflow: 'bank_feed_check',
        company_file: companyFile.company_file_path,
        status: 'warning',
        actions: [
            {
                name: 'bank_feed_check',
                status: 'needs_user',
                message: 'Bank feed download status is not read directly in Phase 1; prompt manual confirmation when needed.',
                timestamp: new Date().toISOString(),
            },
        ],
    };
}
exports.runBankFeedCheck = runBankFeedCheck;
//# sourceMappingURL=bank-feed-check.js.map