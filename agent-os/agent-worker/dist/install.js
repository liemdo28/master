"use strict";
// ============================================================
// Agent OS - Worker - Windows Service Installer
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
// Configuration
const SERVICE_NAME = 'AgentOSWorker';
const DISPLAY_NAME = 'Agent OS Worker';
const DESCRIPTION = 'Agent OS Worker Node for distributed task execution';
const EXECUTABLE = process.execPath;
const SCRIPT_PATH = path.join(__dirname, 'worker.js');
function install() {
    console.log('Installing Agent OS Worker as Windows Service...');
    // Create service
    const scCommand = [
        'sc',
        'create',
        SERVICE_NAME,
        `binPath= "${EXECUTABLE} "${SCRIPT_PATH}""`,
        `DisplayName= "${DISPLAY_NAME}"`,
        `Description= "${DESCRIPTION}"`,
        'start= auto',
    ].join(' ');
    try {
        (0, child_process_1.execSync)(scCommand, { stdio: 'inherit' });
        console.log('Service created successfully');
        // Set recovery options
        (0, child_process_1.execSync)(`sc failure "${SERVICE_NAME}" reset= 86400 actions= restart/60000/restart/60000/restart/60000`, { stdio: 'inherit' });
        // Start service
        (0, child_process_1.execSync)(`sc start "${SERVICE_NAME}"`, { stdio: 'inherit' });
        console.log('Service started');
    }
    catch (err) {
        console.error('Failed to install service:', err);
        console.log('Note: Run as Administrator to install services');
        process.exit(1);
    }
}
function uninstall() {
    console.log('Uninstalling Agent OS Worker...');
    try {
        // Stop service
        (0, child_process_1.execSync)(`sc stop "${SERVICE_NAME}"`, { stdio: 'ignore' });
        console.log('Service stopped');
        // Delete service
        (0, child_process_1.execSync)(`sc delete "${SERVICE_NAME}"`, { stdio: 'inherit' });
        console.log('Service deleted');
    }
    catch (err) {
        console.error('Failed to uninstall service:', err);
    }
}
function start() {
    console.log('Starting Agent OS Worker...');
    (0, child_process_1.execSync)(`sc start "${SERVICE_NAME}"`, { stdio: 'inherit' });
}
function stop() {
    console.log('Stopping Agent OS Worker...');
    (0, child_process_1.execSync)(`sc stop "${SERVICE_NAME}"`, { stdio: 'inherit' });
}
function status() {
    try {
        const result = (0, child_process_1.execSync)(`sc query "${SERVICE_NAME}"`, { encoding: 'utf-8' });
        if (result.includes('RUNNING')) {
            console.log('Service is RUNNING');
        }
        else if (result.includes('STOPPED')) {
            console.log('Service is STOPPED');
        }
        else {
            console.log(result);
        }
    }
    catch {
        console.log('Service not found');
    }
}
// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'start';
switch (command) {
    case 'install':
        install();
        break;
    case 'uninstall':
        uninstall();
        break;
    case 'start':
        start();
        break;
    case 'stop':
        stop();
        break;
    case 'status':
        status();
        break;
    default:
        console.log('Usage: node install.js [install|uninstall|start|stop|status]');
}
//# sourceMappingURL=install.js.map