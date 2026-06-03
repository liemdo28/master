export interface QbXmlRequestOptions {
    companyFilePath?: string;
    requestXml: string;
}
export interface QbXmlResponse {
    success: boolean;
    rawResponse: string | null;
    message: string;
}
/**
 * Phase 1 placeholder for QuickBooks SDK / QBXML integration.
 * This client is intentionally read-only and non-invasive for initial deployment.
 */
export declare function sendQbXmlRequest(options: QbXmlRequestOptions): Promise<QbXmlResponse>;
export declare function testQbSdkConnectivity(): Promise<QbXmlResponse>;
//# sourceMappingURL=qbxml-client.d.ts.map