#!/usr/bin/env node
/**
 * EXPORT SCHEDULER
 * CEO Directive - Auto-update Master Audit Package
 * 
 * Runs every 30 minutes if changes are detected.
 * Uses checksum-based change detection.
 * 
 * Usage:
 *   node export-scheduler.js
 *   node export-scheduler.js --interval 30
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    sourceDir: 'E:\\Project\\Master',
    outputDir: 'E:\\Project\\Master\\_exports',
    statusFile: 'EXPORT_STATUS.json',
    checkSumFile: 'CHANGE_CHECKSUM.json',
    intervalMinutes: 30,
    exporterScript: 'E:\\Project\\Master\\master-exporter\\export-master-audit-package.js',
    
    // Files to monitor for change detection
    watchFiles: [
        // Master intelligence files
        'MASTER_INDEX.json',
        'MASTER_PROJECTS.md',
        'MASTER_INVENTORY.md',
        'MASTER_PROJECT_INDEX.md',
        
        // System graphs
        'dependency-engine/DEPENDENCY_GRAPH.json',
        'knowledge-engine/KNOWLEDGE_GRAPH.json',
        
        // Journal
        'master-journal/events',
        'master-journal/ai-memory',
        
        // Project DNA
        'master-indexer/PROJECT_DNA.md',
        'master-indexer/MASTER_INDEX.json',
        
        // Reports
        'QA_STATUS.md',
        'HEALTH_REPORT.md',
        
        // Engine specs
        'agent-os/ARCHITECTURE.md',
        'agent-os/AGENT_OS_MVP.md',
        'CEO_CHAT_SPEC.md',
        'MASTER_JOURNAL_SPEC.md',
        'KNOWLEDGE_GRAPH_SPEC.md',
        'PROJECT_DNA_SPEC.md'
    ]
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

function logSuccess(message) { log(message, 'SUCCESS'); }
function logWarning(message) { log(message, 'WARNING'); }
function logError(message) { log(message, 'ERROR'); }

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getFileChecksum(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath);
            const hash = crypto.createHash('md5').update(content).digest('hex');
            const stats = fs.statSync(filePath);
            return {
                hash,
                size: stats.size,
                mtime: stats.mtime.toISOString()
            };
        }
    } catch (e) {
        // File not accessible
    }
    return null;
}

function getDirectoryChecksum(dirPath, maxDepth = 2) {
    const checksums = {};
    
    function scanDir(dir, depth = 0) {
        if (depth > maxDepth) return;
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                // Skip excluded dirs
                if (entry.isDirectory()) {
                    if (['node_modules', '.git', 'vendor', 'logs', '_exports', '_snapshots', '_archive'].includes(entry.name)) {
                        continue;
                    }
                    scanDir(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    // Only check important files
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.json', '.md', '.spec.md'].includes(ext)) {
                        const info = getFileChecksum(fullPath);
                        if (info) {
                            checksums[fullPath] = info;
                        }
                    }
                }
            }
        } catch (e) {
            // Directory not accessible
        }
    }
    
    scanDir(dirPath);
    return checksums;
}

function generateOverallChecksum(checksums) {
    const keys = Object.keys(checksums).sort();
    const data = keys.map(k => `${k}:${checksums[k].hash}`).join('|');
    return crypto.createHash('md5').update(data).digest('hex');
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

function loadPreviousChecksums() {
    const checksumPath = path.join(CONFIG.outputDir, CONFIG.checkSumFile);
    try {
        if (fs.existsSync(checksumPath)) {
            return JSON.parse(fs.readFileSync(checksumPath, 'utf8'));
        }
    } catch (e) {
        // No previous checksums
    }
    return null;
}

function saveChecksums(checksums, overallHash) {
    ensureDir(CONFIG.outputDir);
    const checksumPath = path.join(CONFIG.outputDir, CONFIG.checkSumFile);
    fs.writeFileSync(checksumPath, JSON.stringify({
        overallHash,
        checksums,
        updatedAt: new Date().toISOString()
    }, null, 2), 'utf8');
}

function detectChanges() {
    log('Detecting changes...');
    
    // Get current checksums
    const currentChecksums = getDirectoryChecksum(CONFIG.sourceDir);
    const currentOverallHash = generateOverallChecksum(currentChecksums);
    
    // Load previous checksums
    const previous = loadPreviousChecksums();
    
    if (!previous) {
        log('No previous checksums found - will export');
        saveChecksums(currentChecksums, currentOverallHash);
        return { changed: true, reason: 'first_run' };
    }
    
    const previousHash = previous.overallHash;
    
    if (currentOverallHash !== previousHash) {
        // Find what changed
        const changedFiles = [];
        for (const [file, info] of Object.entries(currentChecksums)) {
            const prev = previous.checksums[file];
            if (!prev || prev.hash !== info.hash) {
                changedFiles.push(path.relative(CONFIG.sourceDir, file));
            }
        }
        
        // Find removed files
        for (const [file, prev] of Object.entries(previous.checksums)) {
            if (!currentChecksums[file]) {
                changedFiles.push(`REMOVED: ${path.relative(CONFIG.sourceDir, file)}`);
            }
        }
        
        log(`Changes detected: ${changedFiles.length} files changed`);
        saveChecksums(currentChecksums, currentOverallHash);
        
        return {
            changed: true,
            reason: 'content_changed',
            changedFiles: changedFiles.slice(0, 10) // Limit to first 10
        };
    }
    
    log('No changes detected - skipping export');
    return { changed: false, reason: 'no_changes' };
}

// ============================================================================
// SCHEDULER
// ============================================================================

function runExport() {
    log('Starting scheduled export...');
    
    try {
        const cmd = `node "${CONFIG.exporterScript}" --reason "scheduled-auto"`;
        execSync(cmd, { stdio: 'inherit', cwd: CONFIG.sourceDir });
        logSuccess('Scheduled export completed');
        return true;
    } catch (e) {
        logError('Scheduled export failed: ' + e.message);
        return false;
    }
}

function updateStatus(result) {
    const statusPath = path.join(CONFIG.outputDir, CONFIG.statusFile);
    try {
        const current = fs.existsSync(statusPath) 
            ? JSON.parse(fs.readFileSync(statusPath, 'utf8'))
            : {};
        
        fs.writeFileSync(statusPath, JSON.stringify({
            ...current,
            scheduler: {
                last_check_at: new Date().toISOString(),
                last_check_result: result.changed ? 'exported' : 'skipped',
                reason: result.reason,
                changed_files: result.changedFiles || []
            }
        }, null, 2), 'utf8');
    } catch (e) {
        logWarning('Could not update status: ' + e.message);
    }
}

function runSchedulerCycle() {
    log('='.repeat(60));
    log(`SCHEDULER CYCLE - ${new Date().toISOString()}`);
    log('='.repeat(60));
    
    const result = detectChanges();
    
    if (result.changed) {
        log(`Change detected (${result.reason}) - running export`);
        if (result.changedFiles) {
            log('Changed files:');
            for (const f of result.changedFiles) {
                log(`  - ${f}`);
            }
        }
        
        const exportSuccess = runExport();
        result.exported = exportSuccess;
    } else {
        log('No changes - export skipped');
    }
    
    updateStatus(result);
    return result;
}

function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       MASTER AUDIT PACKAGE SCHEDULER                      ║');
    console.log('║       Auto-update with change detection                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // Parse args
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--interval' && args[i + 1]) {
            CONFIG.intervalMinutes = parseInt(args[i + 1]);
        }
        if (args[i] === '--once') {
            // Run once and exit
            const result = runSchedulerCycle();
            process.exit(result.changed && result.exported !== false ? 0 : 1);
        }
    }
    
    // Ensure output dir exists
    ensureDir(CONFIG.outputDir);
    
    // Run first cycle immediately
    runSchedulerCycle();
    
    // Schedule next cycles
    const intervalMs = CONFIG.intervalMinutes * 60 * 1000;
    log(`Scheduler running - next check in ${CONFIG.intervalMinutes} minutes`);
    
    setInterval(() => {
        runSchedulerCycle();
    }, intervalMs);
    
    // Also check every minute for quick turnaround
    setInterval(() => {
        // Lightweight check only
    }, 60 * 1000);
}

function getStatus() {
    const statusPath = path.join(CONFIG.outputDir, CONFIG.statusFile);
    const checksumPath = path.join(CONFIG.outputDir, CONFIG.checkSumFile);
    
    const status = {
        scheduler: {
            status: 'running',
            interval_minutes: CONFIG.intervalMinutes,
            last_check: null,
            next_check: null
        },
        export: null,
        changes: null
    };
    
    try {
        if (fs.existsSync(statusPath)) {
            const data = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            status.export = {
                last_export_at: data.last_export_at,
                last_export_reason: data.last_export_reason,
                last_export_size: data.last_export_size,
                status: data.status
            };
            if (data.scheduler) {
                status.scheduler.last_check = data.scheduler.last_check_at;
                status.scheduler.last_check_result = data.scheduler.last_check_result;
            }
        }
        
        if (fs.existsSync(checksumPath)) {
            const data = JSON.parse(fs.readFileSync(checksumPath, 'utf8'));
            status.changes = {
                checksum_updated_at: data.updatedAt,
                files_tracked: Object.keys(data.checksums || {}).length
            };
        }
    } catch (e) {
        // Status not available
    }
    
    return status;
}

// Export for module usage
module.exports = {
    runSchedulerCycle,
    detectChanges,
    runExport,
    getStatus,
    CONFIG
};

// Run if executed directly
if (require.main === module) {
    main();
}
