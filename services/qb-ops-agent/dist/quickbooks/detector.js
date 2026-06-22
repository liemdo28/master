"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveCompanyFilePathIfPossible = exports.detectQuickBooksStatus = exports.detectInstalledQuickBooksVersion = exports.isQuickBooksRunning = void 0;
const child_process_1 = require("child_process");
const logs_1 = require("../storage/logs");
function safeExec(command) {
    try {
        return (0, child_process_1.execSync)(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    }
    catch (error) {
        logs_1.logger.debug('Command failed during QuickBooks detection', { command, error: error instanceof Error ? error.message : String(error) });
        return '';
    }
}
function isQuickBooksRunning() {
    const output = safeExec('tasklist /FI "IMAGENAME eq QBW32.EXE"');
    return output.toLowerCase().includes('qbw32.exe');
}
exports.isQuickBooksRunning = isQuickBooksRunning;
function detectInstalledQuickBooksVersion() {
    const commands = [
        'reg query "HKLM\\SOFTWARE\\Intuit\\QuickBooks" /s',
        'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Intuit\\QuickBooks" /s',
    ];
    for (const command of commands) {
        const output = safeExec(command);
        if (!output)
            continue;
        const versionMatch = output.match(/QuickBooks[^\r\n]*?(20\d{2}|Enterprise Solutions \d+\.0|Desktop \d+)/i);
        if (versionMatch)
            return versionMatch[0].trim();
        const yearMatch = output.match(/(20\d{2})/);
        if (yearMatch)
            return `QuickBooks ${yearMatch[1]}`;
    }
    const pathChecks = [
        'if exist "C:\\Program Files\\Intuit\\QuickBooks*" echo installed',
        'if exist "C:\\Program Files (x86)\\Intuit\\QuickBooks*" echo installed',
    ];
    for (const command of pathChecks) {
        const output = safeExec(command);
        if (output.toLowerCase().includes('installed'))
            return 'QuickBooks Desktop (version unknown)';
    }
    return null;
}
exports.detectInstalledQuickBooksVersion = detectInstalledQuickBooksVersion;
function detectQuickBooksStatus() {
    const version = detectInstalledQuickBooksVersion();
    const running = isQuickBooksRunning();
    const status = {
        installed: version !== null,
        running,
        version,
        processName: running ? 'QBW32.EXE' : null,
    };
    logs_1.logger.info('QuickBooks status detected', {
        installed: status.installed,
        running: status.running,
        version: status.version,
    });
    return status;
}
exports.detectQuickBooksStatus = detectQuickBooksStatus;
function getActiveCompanyFilePathIfPossible() {
    // Phase 1 note:
    // We intentionally avoid unsafe UI automation.
    // Active company file detection can be improved later via SDK/Web Connector.
    // For now we return null when not safely available.
    return null;
}
exports.getActiveCompanyFilePathIfPossible = getActiveCompanyFilePathIfPossible;
//# sourceMappingURL=detector.js.map