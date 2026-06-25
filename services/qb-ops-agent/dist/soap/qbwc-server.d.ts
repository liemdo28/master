/**
 * QBWC SOAP Server — handles QuickBooks Web Connector protocol.
 *
 * QBWC calls these SOAP methods in order each sync cycle:
 *   1. authenticate(strUserName, strPassword) → [ticket, ""] or [ticket, "nvu"]
 *   2. sendRequestXML(ticket, strHCPResponse, ...) → qbXML request string
 *   3. receiveResponseXML(ticket, response, hresult, message) → progress % (100 = done)
 *   4. closeConnection(ticket) → "OK"
 *   5. getLastError(ticket) → error string or ""
 *   6. connectionError(ticket, hresult, message) → "done"
 *
 * Mi stores the received QB data in SQLite for the workflow engine to consume.
 */
import express from 'express';
export declare function createQbwcServer(): express.Application;
export declare function startQbwcServer(): void;
//# sourceMappingURL=qbwc-server.d.ts.map