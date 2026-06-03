"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testQbSdkConnectivity = exports.sendQbXmlRequest = void 0;
/**
 * Phase 1 placeholder for QuickBooks SDK / QBXML integration.
 * This client is intentionally read-only and non-invasive for initial deployment.
 */
async function sendQbXmlRequest(options) {
    return {
        success: false,
        rawResponse: null,
        message: `QBXML client not enabled in Phase 1. Intended target: ${options.companyFilePath || 'default company file'}`,
    };
}
exports.sendQbXmlRequest = sendQbXmlRequest;
async function testQbSdkConnectivity() {
    return {
        success: false,
        rawResponse: null,
        message: 'QuickBooks SDK/Web Connector connectivity is planned for Phase 2 read-only checks.',
    };
}
exports.testQbSdkConnectivity = testQbSdkConnectivity;
//# sourceMappingURL=qbxml-client.js.map