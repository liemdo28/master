/**
 * Process Manager for Agent OS
 * Manages Node.js processes and port assignments
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT_REGISTRY_PATH = 'E:\\Project\\Master\\PORT_REGISTRY.json';

/**
 * Execute command and return promise
 */
function execPromise(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                resolve({ error: err.message, stdout: stdout.trim(), stderr: stderr.trim() });
            } else {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
            }
        });
    });
}

/**
 * Load port registry
 */
function loadPortRegistry() {
    try {
        return JSON.parse(fs.readFileSync(PORT_REGISTRY_PATH, 'utf-8'));
    } catch (e) {
        return null;
    }
}

/**
 * Get listening ports
 */
async function getListeningPorts() {
    const result = await execPromise('netstat -ano | findstr LISTENING');
    const lines = result.stdout.split('\n').filter(l => l.includes('LISTENING'));
    
    const ports = [];
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
            const localAddr = parts[1];
            const match = localAddr.match(/:(\d+)$/);
            if (match) {
                ports.push({
                    protocol: parts[0],
                    address: localAddr,
                    port: parseInt(match[1]),
                    pid: parseInt(parts[parts.length - 1])
                });
            }
        }
    }
    return ports;
}

/**
 * Get Node.js processes
 */
async function getNodeProcesses() {
    const result = await execPromise('powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Select-Object ProcessId, Name, CommandLine | ConvertTo-Json"');
    
    try {
        const processes = JSON.parse(result.stdout);
        return Array.isArray(processes) ? processes : [processes];
    } catch (e) {
        return [];
    }
}

/**
 * List all processes
 */
async function listProcesses() {
    const ports = await getListeningPorts();
    const nodeProcesses = await getNodeProcesses();
    const registry = loadPortRegistry();
    
    const nodePorts = ports.filter(p => p.port >= 3000 && p.port <= 4000);
    
    console.log('\n=== Agent OS Node.js Processes ===\n');
    console.log(`Registry: ${registry ? 'Loaded' : 'Not Found'}\n`);
    
    console.log('Listening Ports (3000-4000):');
    nodePorts.forEach(p => {
        const owner = registry?.ports[Object.keys(registry.ports).find(k => registry.ports[k].port === p.port)];
        console.log(`  ${p.protocol.padEnd(4)} Port ${p.port.toString().padStart(5)} -> PID ${p.pid} ${owner ? '(' + owner.owner + ')' : ''}`);
    });
    
    console.log('\nNode.js Processes:');
    nodeProcesses.forEach(p => {
        const cmdLine = p.CommandLine || 'Unknown';
        const projectMatch = cmdLine.match(/E:\\[^\\]+/);
        console.log(`  PID ${p.ProcessId.toString().padStart(6)}: ${projectMatch ? projectMatch[0] : 'System'}`);
    });
    
    return { ports: nodePorts, processes: nodeProcesses };
}

/**
 * Audit processes
 */
async function auditProcesses() {
    const ports = await getListeningPorts();
    const nodeProcesses = await getNodeProcesses();
    const registry = loadPortRegistry();
    
    const nodePorts = ports.filter(p => p.port >= 3000 && p.port <= 4000);
    const conflicts = [];
    const orphans = [];
    
    // Check for port conflicts
    for (const port of nodePorts) {
        const samePort = nodePorts.filter(p => p.port === port.port);
        if (samePort.length > 1) {
            conflicts.push({
                port: port.port,
                pids: samePort.map(p => p.pid),
                type: 'DUPLICATE_PORT'
            });
        }
    }
    
    // Check for orphan processes
    for (const proc of nodeProcesses) {
        const cmdLine = proc.CommandLine || '';
        const hasProjectPath = cmdLine.includes('E:\\Project\\Master');
        const isPM2 = cmdLine.includes('pm2') || cmdLine.includes('ProcessContainerFork');
        const isNpx = cmdLine.includes('npx') || cmdLine.includes('npm-cache');
        
        if (!hasProjectPath && !isPM2) {
            orphans.push({
                pid: proc.ProcessId,
                type: isNpx ? 'NPX' : 'UNKNOWN',
                command: cmdLine.substring(0, 100)
            });
        }
    }
    
    const result = {
        status: conflicts.length === 0 && orphans.length < 3 ? 'PASS' : 'FAIL',
        ports: nodePorts,
        nodeProcesses: nodeProcesses.map(p => ({
            pid: p.ProcessId,
            command: (p.CommandLine || '').substring(0, 200)
        })),
        conflicts,
        orphans,
        registry: registry ? 'Loaded' : 'Not Found',
        timestamp: new Date().toISOString()
    };
    
    console.log('\n=== Process Audit ===\n');
    console.log(`Status: ${result.status}`);
    console.log(`Active Ports: ${nodePorts.length}`);
    console.log(`Node Processes: ${nodeProcesses.length}`);
    console.log(`Conflicts: ${conflicts.length}`);
    console.log(`Orphans: ${orphans.length}`);
    
    if (conflicts.length > 0) {
        console.log('\n⚠️  Conflicts Detected:');
        conflicts.forEach(c => {
            console.log(`  Port ${c.port}: PIDs ${c.pids.join(', ')}`);
        });
    }
    
    if (orphans.length > 0) {
        console.log('\n⚠️  Orphan Processes:');
        orphans.forEach(o => {
            console.log(`  PID ${o.pid} (${o.type}): ${o.command}...`);
        });
    }
    
    console.log('\n' + JSON.stringify(result, null, 2));
    return result;
}

/**
 * Kill orphan processes (with care)
 */
async function killOrphans() {
    const audit = await auditProcesses();
    
    if (audit.orphans.length === 0) {
        console.log('\nNo orphan processes to kill.');
        return { killed: [], status: 'PASS' };
    }
    
    console.log('\n⚠️  Caution: Will only kill processes without project path and not PM2-related');
    
    const killed = [];
    const safeOrphans = audit.orphans.filter(o => {
        // Only kill if clearly orphan (npx without project)
        return o.type === 'NPX' && !o.command.includes('Project');
    });
    
    if (safeOrphans.length === 0) {
        console.log('No safe orphans to kill. All processes have valid associations.');
        return { killed: [], status: 'PASS', reason: 'All orphans have valid associations' };
    }
    
    console.log(`\nKilling ${safeOrphans.length} orphan process(es)...`);
    
    for (const orphan of safeOrphans) {
        console.log(`  Killing PID ${orphan.pid}...`);
        const result = await execPromise(`taskkill /PID ${orphan.pid} /F`);
        if (result.error) {
            console.log(`    Failed: ${result.error}`);
        } else {
            console.log(`    Success`);
            killed.push(orphan.pid);
        }
    }
    
    // Re-audit after kill
    console.log('\n=== Post-Kill Audit ===');
    const postAudit = await auditProcesses();
    
    return {
        killed,
        status: postAudit.conflicts.length === 0 ? 'PASS' : 'FAIL',
        postAudit
    };
}

/**
 * Validate ports against registry
 */
async function validatePorts() {
    const ports = await getListeningPorts();
    const registry = loadPortRegistry();
    
    if (!registry) {
        const result = {
            status: 'UNKNOWN',
            error: 'PORT_REGISTRY.json not found',
            timestamp: new Date().toISOString()
        };
        console.log('\n' + JSON.stringify(result, null, 2));
        return result;
    }
    
    const registeredPorts = Object.values(registry.ports)
        .filter(p => p.port !== null)
        .map(p => p.port);
    
    // Only look at Agent OS ports (3000-4000) and localhost
    const agentOsPorts = ports
        .filter(p => p.port >= 3000 && p.port <= 4000 && (p.address.includes('127.0.0.1') || p.address.includes('0.0.0.0')))
        .map(p => ({ port: p.port, pid: p.pid }));
    
    const listeningPorts = agentOsPorts.map(p => p.port);
    
    // Get unique ports only
    const uniqueListeningPorts = [...new Set(listeningPorts)];
    
    const unregistered = uniqueListeningPorts.filter(p => !registeredPorts.includes(p));
    const missing = registeredPorts.filter(p => !uniqueListeningPorts.includes(p));
    
    // Check for duplicates (multiple PIDs on same port)
    const portCounts = {};
    listeningPorts.forEach(p => { portCounts[p] = (portCounts[p] || 0) + 1; });
    const duplicates = Object.entries(portCounts).filter(([_, count]) => count > 1);
    
    const result = {
        status: duplicates.length === 0 ? 'PASS' : 'FAIL',
        timestamp: new Date().toISOString(),
        validation: {
            registeredPorts,
            listeningPorts,
            unregistered,
            missing,
            duplicates: duplicates.map(([port, count]) => ({ port: parseInt(port), count }))
        },
        details: {
            port3456: {
                owner: registry.ports['api-proxy']?.owner,
                expected: 3456,
                actual: listeningPorts.includes(3456),
                pid: ports.find(p => p.port === 3456)?.pid || null
            },
            port3700: {
                owner: registry.ports['agent-control']?.owner,
                expected: 3700,
                actual: listeningPorts.includes(3700),
                pid: ports.find(p => p.port === 3700)?.pid || null
            }
        }
    };
    
    console.log('\n=== Port Validation ===\n');
    console.log(`Status: ${result.status}`);
    console.log(`Registered Ports: ${registeredPorts.join(', ')}`);
    console.log(`Listening Ports: ${listeningPorts.join(', ')}`);
    
    if (unregistered.length > 0) {
        console.log(`\n⚠️  Unregistered Ports: ${unregistered.join(', ')}`);
    }
    
    if (missing.length > 0) {
        console.log(`\n⚠️  Missing Ports: ${missing.join(', ')}`);
    }
    
    if (duplicates.length > 0) {
        console.log(`\n❌  Duplicate Ports: ${duplicates.map(d => d[0]).join(', ')}`);
    }
    
    console.log('\n' + JSON.stringify(result, null, 2));
    return result;
}

/**
 * Main CLI
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'list';
    
    console.log(`[Process Manager] Command: ${command}`);
    console.log(`[Process Manager] Time: ${new Date().toISOString()}`);
    
    let result;
    
    switch (command) {
        case 'list':
            result = await listProcesses();
            break;
        case 'audit':
            result = await auditProcesses();
            break;
        case 'kill-orphans':
            result = await killOrphans();
            break;
        case 'validate-ports':
            result = await validatePorts();
            break;
        default:
            console.log('\nUsage: node process-manager.js <command>');
            console.log('\nCommands:');
            console.log('  list          - List all Node.js processes');
            console.log('  audit         - Audit processes and detect issues');
            console.log('  kill-orphans  - Kill orphan processes (safe)');
            console.log('  validate-ports - Validate against PORT_REGISTRY.json');
            process.exit(1);
    }
    
    const exitCode = result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2;
    process.exit(exitCode);
}

// Export for module use
module.exports = {
    listProcesses,
    auditProcesses,
    killOrphans,
    validatePorts,
    getListeningPorts,
    getNodeProcesses
};

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
