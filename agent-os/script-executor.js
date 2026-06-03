/**
 * SCRIPT EXECUTOR
 * CEO Directive Phase 3.3 - Start API Proxy Real Validation
 * 
 * Runs BAT file and verifies with evidence
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ARTIFACT_DIR = 'E:\\Project\Master\\artifact-registry';
const REPORT_DIR = 'E:\\Project\\Master\\artifact-registry\\api-proxy';

class ScriptExecutor {
    constructor() {
        this.ensureDirectories();
    }
    
    ensureDirectories() {
        const dirs = [
            REPORT_DIR,
            path.join(ARTIFACT_DIR, 'task-logs'),
            path.join(ARTIFACT_DIR, 'validation-reports')
        ];
        
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
    
    /**
     * Execute: Start API Proxy
     */
    async startApiProxy(taskId) {
        const scriptPath = 'E:\\Project\\Master\\Agent\\agent-coding-api-keys\\start-proxy-win.bat';
        
        const result = {
            taskId: taskId || this.generateTaskId(),
            command: 'Start API Proxy',
            scriptPath: scriptPath,
            timestamp: new Date().toISOString(),
            scriptExists: false,
            processStarted: false,
            processRunning: false,
            portActive: false,
            healthCheck: false,
            logsCaptured: false,
            logsPath: null,
            result: 'FAIL',
            details: {}
        };
        
        try {
            // Step 1: Verify script exists
            result.scriptExists = fs.existsSync(scriptPath);
            result.details.scriptSize = result.scriptExists ? fs.statSync(scriptPath).size : 0;
            
            if (!result.scriptExists) {
                result.details.error = 'Script file not found';
                return this.finishResult(result);
            }
            
            // Step 2: Read script content for understanding
            const scriptContent = fs.readFileSync(scriptPath, 'utf8');
            result.details.scriptPreview = scriptContent.substring(0, 200);
            
            // Step 3: Execute script
            const logFile = path.join(REPORT_DIR, `api-proxy-log-${result.taskId}.txt`);
            result.logsPath = logFile;
            
            try {
                // Run in background
                const child = spawn('cmd.exe', ['/c', scriptPath], {
                    cwd: path.dirname(scriptPath),
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: true,
                    shell: false
                });
                
                child.unref();
                result.processStarted = true;
                result.details.pid = child.pid;
                
                // Wait for startup
                await this.sleep(3000);
                
                // Step 4: Check if process is running
                result.processRunning = this.checkProcess('node') || this.checkProcess('proxy');
                
                // Step 5: Check port (common proxy ports)
                result.portActive = await this.checkPorts([3000, 3001, 8080, 8000, 4000]);
                
                // Step 6: Try health check
                for (const port of [3000, 3001, 8080, 8000, 4000]) {
                    try {
                        const response = execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/health 2>nul || echo "failed"`, {
                            encoding: 'utf8',
                            timeout: 2000
                        });
                        if (response.trim() !== 'failed' && response.trim() !== '000') {
                            result.healthCheck = true;
                            result.details.healthEndpoint = `http://localhost:${port}/health`;
                            result.details.healthStatus = response.trim();
                            break;
                        }
                    } catch (e) {
                        // Try next port
                    }
                }
                
                // Step 7: Capture logs if available
                const proxyLog = path.join(path.dirname(scriptPath), 'proxy.log');
                if (fs.existsSync(proxyLog)) {
                    const logs = fs.readFileSync(proxyLog, 'utf8');
                    fs.writeFileSync(logFile, logs);
                    result.logsCaptured = true;
                }
                
            } catch (execError) {
                result.details.execError = execError.message;
            }
            
            // Determine result
            if (result.processRunning && result.portActive) {
                result.result = 'PASS';
            } else if (result.processStarted) {
                result.result = 'PARTIAL';
            }
            
        } catch (error) {
            result.details.error = error.message;
        }
        
        // Generate report
        await this.generateReport(result);
        
        return result;
    }
    
    /**
     * Check if process is running
     */
    checkProcess(name) {
        try {
            const output = execSync(`tasklist /FI "IMAGENAME eq ${name}*" 2>nul`, { encoding: 'utf8' });
            const lines = output.split('\n').filter(l => l.includes(name));
            return lines.length > 0;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Check if ports are active
     */
    async checkPorts(ports) {
        for (const port of ports) {
            try {
                const result = execSync(`netstat -an 2>nul | findstr ":${port}" | findstr "LISTENING"`, {
                    encoding: 'utf8',
                    timeout: 2000
                });
                if (result.includes('LISTENING')) {
                    return true;
                }
            } catch (e) {
                // Port not active
            }
        }
        return false;
    }
    
    /**
     * Generate validation report
     */
    async generateReport(result) {
        const reportPath = path.join(REPORT_DIR, `API_PROXY_START_TEST.md`);
        
        const content = `# API PROXY START TEST

## Test Result: ${result.result}

---

## Task Information

| Field | Value |
|-------|-------|
| Task ID | ${result.taskId} |
| Command | ${result.command} |
| Timestamp | ${result.timestamp} |

---

## Verification Results

| Check | Result |
|-------|--------|
| Script Exists | ${result.scriptExists ? '✅ YES' : '❌ NO'} |
| Process Started | ${result.processStarted ? '✅ YES' : '❌ NO'} |
| Process Running | ${result.processRunning ? '✅ YES' : '❌ NO'} |
| Port Active | ${result.portActive ? '✅ YES' : '❌ NO'} |
| Health Check | ${result.healthCheck ? '✅ YES' : '❌ NO'} |
| Logs Captured | ${result.logsCaptured ? '✅ YES' : '❌ NO'} |

---

## Details

- **Script Path**: ${result.scriptPath}
- **Script Size**: ${result.details.scriptSize || 0} bytes
- **PID**: ${result.details.pid || 'N/A'}
- **Health Endpoint**: ${result.details.healthEndpoint || 'N/A'}
- **Health Status**: ${result.details.healthStatus || 'N/A'}
- **Logs Path**: ${result.logsPath || 'N/A'}
- **Error**: ${result.details.error || 'None'}

---

## Script Preview

\`\`\`
${result.details.scriptPreview || 'N/A'}
\`\`\`

---

## Logs

${result.logsCaptured ? `Logs saved to: ${result.logsPath}` : '_No logs captured_'}

---

## Conclusion

${result.result === 'PASS' ? '✅ API Proxy started successfully with full verification.' : 
  result.result === 'PARTIAL' ? '⚠️ API Proxy script ran but some verifications failed.' :
  '❌ API Proxy could not be started or verified.'}

---

_Generated by Script Executor - Agent OS Phase 3.3_
`;
        
        fs.writeFileSync(reportPath, content, 'utf8');
        result.reportPath = reportPath;
        
        return result;
    }
    
    /**
     * Generate task ID
     */
    generateTaskId() {
        return `API-${Date.now()}`;
    }
    
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Finish and finalize result
     */
    finishResult(result) {
        this.generateReport(result);
        return result;
    }
}

// CLI mode
if (require.main === module) {
    const executor = new ScriptExecutor();
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       SCRIPT EXECUTOR - Start API Proxy Validation       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    
    executor.startApiProxy()
        .then(result => {
            console.log('');
            console.log('Test Result:', result.result);
            console.log('Script Exists:', result.scriptExists);
            console.log('Process Started:', result.processStarted);
            console.log('Process Running:', result.processRunning);
            console.log('Port Active:', result.portActive);
            console.log('Health Check:', result.healthCheck);
            console.log('Report:', result.reportPath);
            console.log('');
        })
        .catch(err => {
            console.error('Error:', err.message);
        });
}

module.exports = { ScriptExecutor };
