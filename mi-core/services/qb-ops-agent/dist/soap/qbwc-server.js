"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startQbwcServer = exports.createQbwcServer = void 0;
const express_1 = __importDefault(require("express"));
const logs_1 = require("../storage/logs");
const qb_data_store_1 = require("./qb-data-store");
const QBWC_PORT = parseInt(process.env.QBWC_PORT || '3457', 10);
const QBWC_USER = process.env.QBWC_USER || 'mi-qb-agent';
const QBWC_PASS = process.env.QB_API_KEY || 'b149c4783a1109ff46d01498d91766e7';
// Active session tickets: ticket → { companyFile, requestsSent, done }
const sessions = new Map();
// QB XML requests to send (read-only data pulls)
const QB_REQUESTS = [
    // Accounts list
    `<?xml version="1.0" encoding="utf-8"?><?qbxml version="13.0"?>
<QBXML><QBXMLMsgsRq onError="stopOnError">
  <AccountQueryRq requestID="1"><AccountType>Income</AccountType></AccountQueryRq>
  <AccountQueryRq requestID="2"><AccountType>Expense</AccountType></AccountQueryRq>
</QBXMLMsgsRq></QBXML>`,
    // Sales receipts last 30 days
    `<?xml version="1.0" encoding="utf-8"?><?qbxml version="13.0"?>
<QBXML><QBXMLMsgsRq onError="stopOnError">
  <SalesReceiptQueryRq requestID="3">
    <ModifiedDateRangeFilter>
      <FromModifiedDate>${getDateDaysAgo(30)}</FromModifiedDate>
    </ModifiedDateRangeFilter>
    <IncludeLineItems>true</IncludeLineItems>
  </SalesReceiptQueryRq>
</QBXMLMsgsRq></QBXML>`,
    // Invoices last 30 days
    `<?xml version="1.0" encoding="utf-8"?><?qbxml version="13.0"?>
<QBXML><QBXMLMsgsRq onError="stopOnError">
  <InvoiceQueryRq requestID="4">
    <ModifiedDateRangeFilter>
      <FromModifiedDate>${getDateDaysAgo(30)}</FromModifiedDate>
    </ModifiedDateRangeFilter>
    <IncludeLineItems>true</IncludeLineItems>
  </InvoiceQueryRq>
</QBXMLMsgsRq></QBXML>`,
];
function getDateDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}
function generateTicket() {
    return `mi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
// ── SOAP response builders ─────────────────────────────────────────────────
function soapEnvelope(method, content) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${method}Response xmlns="http://developer.intuit.com/qbwc/wsdl">
      ${content}
    </${method}Response>
  </soap:Body>
</soap:Envelope>`;
}
function extractSoapValue(body, tag) {
    const match = body.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i'));
    return match ? match[1].trim() : '';
}
// ── Route handler ──────────────────────────────────────────────────────────
function createQbwcServer() {
    const app = (0, express_1.default)();
    // QBWC sends text/xml
    app.use(express_1.default.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'], limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // WSDL endpoint
    app.get('/qbwc', (_req, res) => {
        res.type('text/xml').send(WSDL);
    });
    // SOAP endpoint
    app.post('/qbwc', (req, res) => {
        const body = typeof req.body === 'string' ? req.body : '';
        const soapAction = Array.isArray(req.headers['soapaction']) ? req.headers['soapaction'][0] : (req.headers['soapaction'] || '');
        const action = soapAction.replace(/"/g, '').split('/').pop() || '';
        logs_1.logger.info(`QBWC SOAP call: ${action}`);
        let responseXml = '';
        if (action === 'authenticate' || body.includes('authenticate')) {
            responseXml = handleAuthenticate(body);
        }
        else if (action === 'sendRequestXML' || body.includes('sendRequestXML')) {
            responseXml = handleSendRequestXML(body);
        }
        else if (action === 'receiveResponseXML' || body.includes('receiveResponseXML')) {
            responseXml = handleReceiveResponseXML(body);
        }
        else if (action === 'closeConnection' || body.includes('closeConnection')) {
            responseXml = handleCloseConnection(body);
        }
        else if (action === 'getLastError' || body.includes('getLastError')) {
            responseXml = handleGetLastError(body);
        }
        else if (action === 'connectionError' || body.includes('connectionError')) {
            responseXml = handleConnectionError(body);
        }
        else {
            logs_1.logger.warn(`Unknown SOAP action: ${action}`);
            res.status(400).send('Unknown SOAP action');
            return;
        }
        res.type('text/xml').send(responseXml);
    });
    // REST status endpoint
    app.get('/api/status', (_req, res) => {
        const status = (0, qb_data_store_1.getLastSyncStatus)();
        res.json({
            status: 'ok',
            qbwc_port: QBWC_PORT,
            active_sessions: sessions.size,
            ...status,
        });
    });
    // Financial summary — parsed from raw QBXML
    app.get('/api/financial/summary', (_req, res) => {
        try {
            const summary = (0, qb_data_store_1.parseFinancialSummary)();
            res.json({ status: 'ok', ...summary });
        }
        catch (e) {
            res.status(500).json({ status: 'error', error: e.message });
        }
    });
    // Accounts list
    app.get('/api/financial/accounts', (_req, res) => {
        try {
            const { accounts, total_income, total_expense, net_income } = (0, qb_data_store_1.parseFinancialSummary)();
            res.json({ status: 'ok', accounts, total_income, total_expense, net_income });
        }
        catch (e) {
            res.status(500).json({ status: 'error', error: e.message });
        }
    });
    // Sales receipts
    app.get('/api/financial/receipts', (_req, res) => {
        try {
            const { sales_receipts_30d, total_sales_30d } = (0, qb_data_store_1.parseFinancialSummary)();
            res.json({ status: 'ok', receipts: sales_receipts_30d, total: total_sales_30d });
        }
        catch (e) {
            res.status(500).json({ status: 'error', error: e.message });
        }
    });
    // Invoices
    app.get('/api/financial/invoices', (_req, res) => {
        try {
            const { invoices_30d, total_invoices_30d, outstanding_invoices } = (0, qb_data_store_1.parseFinancialSummary)();
            res.json({ status: 'ok', invoices: invoices_30d, total: total_invoices_30d, outstanding: outstanding_invoices });
        }
        catch (e) {
            res.status(500).json({ status: 'error', error: e.message });
        }
    });
    return app;
}
exports.createQbwcServer = createQbwcServer;
// ── SOAP method handlers ───────────────────────────────────────────────────
function handleAuthenticate(body) {
    const user = extractSoapValue(body, 'strUserName');
    const pass = extractSoapValue(body, 'strPassword');
    logs_1.logger.info(`QBWC authenticate: user="${user}"`);
    if (pass !== QBWC_PASS) {
        logs_1.logger.warn(`QBWC auth failed for user: ${user}`);
        // Return ["", "nvu"] = invalid username/password
        return soapEnvelope('authenticate', `<authenticateResult><string></string><string>nvu</string></authenticateResult>`);
    }
    const ticket = generateTicket();
    sessions.set(ticket, { companyFile: '', requestIndex: 0, done: false });
    logs_1.logger.info(`QBWC authenticated, ticket: ${ticket}`);
    // Return [ticket, ""] = success, use currently open company file
    return soapEnvelope('authenticate', `<authenticateResult><string>${ticket}</string><string></string></authenticateResult>`);
}
function handleSendRequestXML(body) {
    const ticket = extractSoapValue(body, 'ticket');
    const companyFile = extractSoapValue(body, 'strCompanyFileName') ||
        extractSoapValue(body, 'strHCPResponse');
    const session = sessions.get(ticket);
    if (!session) {
        logs_1.logger.warn(`sendRequestXML: unknown ticket ${ticket}`);
        return soapEnvelope('sendRequestXML', `<sendRequestXMLResult></sendRequestXMLResult>`);
    }
    if (companyFile && !session.companyFile) {
        session.companyFile = companyFile;
    }
    const requestXml = QB_REQUESTS[session.requestIndex];
    if (!requestXml) {
        // All requests sent — signal done
        return soapEnvelope('sendRequestXML', `<sendRequestXMLResult></sendRequestXMLResult>`);
    }
    logs_1.logger.info(`Sending QB request ${session.requestIndex + 1}/${QB_REQUESTS.length} to QBWC`);
    return soapEnvelope('sendRequestXML', `<sendRequestXMLResult><![CDATA[${requestXml}]]></sendRequestXMLResult>`);
}
function handleReceiveResponseXML(body) {
    const ticket = extractSoapValue(body, 'ticket');
    const response = extractSoapValue(body, 'response');
    const hresult = extractSoapValue(body, 'hresult');
    const message = extractSoapValue(body, 'message');
    const session = sessions.get(ticket);
    if (!session) {
        return soapEnvelope('receiveResponseXML', `<receiveResponseXMLResult>100</receiveResponseXMLResult>`);
    }
    if (hresult && hresult !== '0x00000000') {
        logs_1.logger.error(`QBWC receiveResponse error: ${hresult} — ${message}`);
    }
    else if (response) {
        logs_1.logger.info(`Received QB response for request ${session.requestIndex + 1}`);
        (0, qb_data_store_1.storeQbData)(session.requestIndex, session.companyFile, response);
    }
    session.requestIndex++;
    const remaining = QB_REQUESTS.length - session.requestIndex;
    const progress = remaining <= 0 ? 100 : Math.floor((session.requestIndex / QB_REQUESTS.length) * 99);
    logs_1.logger.info(`QBWC progress: ${progress}% (${session.requestIndex}/${QB_REQUESTS.length})`);
    return soapEnvelope('receiveResponseXML', `<receiveResponseXMLResult>${progress}</receiveResponseXMLResult>`);
}
function handleCloseConnection(body) {
    const ticket = extractSoapValue(body, 'ticket');
    sessions.delete(ticket);
    logs_1.logger.info(`QBWC closeConnection: ticket ${ticket}`);
    return soapEnvelope('closeConnection', `<closeConnectionResult>OK</closeConnectionResult>`);
}
function handleGetLastError(body) {
    const ticket = extractSoapValue(body, 'ticket');
    logs_1.logger.info(`QBWC getLastError: ticket ${ticket}`);
    return soapEnvelope('getLastError', `<getLastErrorResult></getLastErrorResult>`);
}
function handleConnectionError(body) {
    const ticket = extractSoapValue(body, 'ticket');
    const hresult = extractSoapValue(body, 'hresult');
    const message = extractSoapValue(body, 'message');
    logs_1.logger.error(`QBWC connectionError: ${hresult} — ${message} (ticket: ${ticket})`);
    sessions.delete(ticket);
    return soapEnvelope('connectionError', `<connectionErrorResult>done</connectionErrorResult>`);
}
// ── WSDL ──────────────────────────────────────────────────────────────────
const WSDL = `<?xml version="1.0" encoding="utf-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="http://developer.intuit.com/qbwc/wsdl"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  name="QBWebConnectorSvc"
  targetNamespace="http://developer.intuit.com/qbwc/wsdl">
  <types>
    <xsd:schema targetNamespace="http://developer.intuit.com/qbwc/wsdl">
      <xsd:element name="authenticate"><xsd:complexType><xsd:sequence>
        <xsd:element name="strUserName" type="xsd:string"/>
        <xsd:element name="strPassword" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="authenticateResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="authenticateResult"><xsd:complexType><xsd:sequence>
          <xsd:element maxOccurs="unbounded" name="string" type="xsd:string"/>
        </xsd:sequence></xsd:complexType></xsd:element>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="sendRequestXML"><xsd:complexType><xsd:sequence>
        <xsd:element name="ticket" type="xsd:string"/>
        <xsd:element name="strHCPResponse" type="xsd:string"/>
        <xsd:element name="strCompanyFileName" type="xsd:string"/>
        <xsd:element name="qbXMLCountry" type="xsd:string"/>
        <xsd:element name="qbXMLMajorVers" type="xsd:int"/>
        <xsd:element name="qbXMLMinorVers" type="xsd:int"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="sendRequestXMLResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="sendRequestXMLResult" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="receiveResponseXML"><xsd:complexType><xsd:sequence>
        <xsd:element name="ticket" type="xsd:string"/>
        <xsd:element name="response" type="xsd:string"/>
        <xsd:element name="hresult" type="xsd:string"/>
        <xsd:element name="message" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="receiveResponseXMLResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="receiveResponseXMLResult" type="xsd:int"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="closeConnection"><xsd:complexType><xsd:sequence>
        <xsd:element name="ticket" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="closeConnectionResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="closeConnectionResult" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="getLastError"><xsd:complexType><xsd:sequence>
        <xsd:element name="ticket" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="getLastErrorResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="getLastErrorResult" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="connectionError"><xsd:complexType><xsd:sequence>
        <xsd:element name="ticket" type="xsd:string"/>
        <xsd:element name="hresult" type="xsd:string"/>
        <xsd:element name="message" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
      <xsd:element name="connectionErrorResponse"><xsd:complexType><xsd:sequence>
        <xsd:element name="connectionErrorResult" type="xsd:string"/>
      </xsd:sequence></xsd:complexType></xsd:element>
    </xsd:schema>
  </types>
  <message name="authenticateRequest"><part name="parameters" element="tns:authenticate"/></message>
  <message name="authenticateResponse"><part name="parameters" element="tns:authenticateResponse"/></message>
  <message name="sendRequestXMLRequest"><part name="parameters" element="tns:sendRequestXML"/></message>
  <message name="sendRequestXMLResponse"><part name="parameters" element="tns:sendRequestXMLResponse"/></message>
  <message name="receiveResponseXMLRequest"><part name="parameters" element="tns:receiveResponseXML"/></message>
  <message name="receiveResponseXMLResponse"><part name="parameters" element="tns:receiveResponseXMLResponse"/></message>
  <message name="closeConnectionRequest"><part name="parameters" element="tns:closeConnection"/></message>
  <message name="closeConnectionResponse"><part name="parameters" element="tns:closeConnectionResponse"/></message>
  <message name="getLastErrorRequest"><part name="parameters" element="tns:getLastError"/></message>
  <message name="getLastErrorResponse"><part name="parameters" element="tns:getLastErrorResponse"/></message>
  <message name="connectionErrorRequest"><part name="parameters" element="tns:connectionError"/></message>
  <message name="connectionErrorResponse"><part name="parameters" element="tns:connectionErrorResponse"/></message>
  <portType name="QBWebConnectorSvcSoap">
    <operation name="authenticate"><input message="tns:authenticateRequest"/><output message="tns:authenticateResponse"/></operation>
    <operation name="sendRequestXML"><input message="tns:sendRequestXMLRequest"/><output message="tns:sendRequestXMLResponse"/></operation>
    <operation name="receiveResponseXML"><input message="tns:receiveResponseXMLRequest"/><output message="tns:receiveResponseXMLResponse"/></operation>
    <operation name="closeConnection"><input message="tns:closeConnectionRequest"/><output message="tns:closeConnectionResponse"/></operation>
    <operation name="getLastError"><input message="tns:getLastErrorRequest"/><output message="tns:getLastErrorResponse"/></operation>
    <operation name="connectionError"><input message="tns:connectionErrorRequest"/><output message="tns:connectionErrorResponse"/></operation>
  </portType>
  <binding name="QBWebConnectorSvcSoap" type="tns:QBWebConnectorSvcSoap">
    <soap:binding transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="authenticate"><soap:operation soapAction="http://developer.intuit.com/qbwc/wsdl/authenticate"/><input><soap:body use="literal"/></input><output><soap:body use="literal"/></output></operation>
    <operation name="sendRequestXML"><soap:operation soapAction="http://developer.intuit.com/qbwc/wsdl/sendRequestXML"/><input><soap:body use="literal"/></input><output><soap:body use="literal"/></output></operation>
    <operation name="receiveResponseXML"><soap:operation soapAction="http://developer.intuit.com/qbwc/wsdl/receiveResponseXML"/><input><soap:body use="literal"/></input><output><soap:body use="literal"/></output></operation>
    <operation name="closeConnection"><soap:operation soapAction="http://developer.intuit.com/qbwc/wsdl/closeConnection"/><input><soap:body use="literal"/></input><output><soap:body use="literal"/></output></operation>
    <operation name="getLastError"><soap:operation soapAction="http://developer.intuit.com/qbwc/wsdl/getLastError"/><input><soap:body use="literal"/></input><output><soap:body use="literal"/></output></operation>
    <operation name="connectionError"><soap:operation soapAction="http://developer.intuit.com/qbwc/wsdl/connectionError"/><input><soap:body use="literal"/></input><output><soap:body use="literal"/></output></operation>
  </binding>
  <service name="QBWebConnectorSvc">
    <port name="QBWebConnectorSvcSoap" binding="tns:QBWebConnectorSvcSoap">
      <soap:address location="http://localhost:3457/qbwc"/>
    </port>
  </service>
</definitions>`;
function startQbwcServer() {
    const app = createQbwcServer();
    app.listen(QBWC_PORT, '0.0.0.0', () => {
        logs_1.logger.info(`QBWC SOAP server listening on port ${QBWC_PORT}`);
        logs_1.logger.info(`WSDL: http://localhost:${QBWC_PORT}/qbwc?wsdl`);
        logs_1.logger.info(`SOAP: http://localhost:${QBWC_PORT}/qbwc`);
    });
}
exports.startQbwcServer = startQbwcServer;
//# sourceMappingURL=qbwc-server.js.map