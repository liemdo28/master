#!/usr/bin/env node
/**
 * LIFECYCLE TRIGGER
 * CEO Directive - DEV 3 Refactor
 * 
 * NEW FLOW: Lifecycle Event -> Validation -> Artifact -> Journal -> Export
 * 
 * This script is called by Agent OS after task lifecycle events.
 * It runs validation BEFORE export, then includes validation results
 * in the audit package.
 * 
 * Usage:
 *   node lifecycle-trigger.js --event build_completed
 *   node lifecycle-trigger.js --event qa_completed
 *   node lifecycle-trigger.js --event manual
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    sourceDir: 'E:\\Project\\Master',
    outputDir: 'E:\\Project\\Master\\_exports',
    statusFile: 'EXPORT_STATUS.json',
    exporterScript: 'E:\\Project\\Master\\master-exporter\\export-master-audit-package.js',
    validationEngine: 'E:\\Project\\Master\\validation-engine\\cli.js',
    
    // Task lifecycle events that trigger auto-export
    triggerEvents: [
        'build_completed',
        'fix_completed',
        'qa_completed',
        'source_index_completed',
        'dependency_graph_completed',
        'knowledge_graph_completed',
        'project_dna_generated',
        'journal_event_created',
        'release_candidate_completed'
    ],
    
    // Validators to run before export
    validators: [
        'api-proxy',
        'antigravity',
        'agent-os'
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

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// ============================================================================
// VALIDATION ENGINE INTEGRATION (CEO DEV 3)
// ============================================================================

/**
 * Run validation for a specific validator
 */
function runValidation(validatorName) {
    return new Promise((resolve) => {
        const validationCmd = `node "${CONFIG.validationEngine}" "Validate ${validatorName}"`;
        
        try {
            const output = execSync(validationCmd, { 
                cwd: path.dirname(CONFIG.validationEngine),
                encoding: 'utf8',
                timeout: 120000
            });
            
            // Parse result from output
            const resultMatch = output.match(/--- RESULT ---\s*([\s\S]*?)$/);
            if (resultMatch) {
                try {
                    const result = JSON.parse(resultMatch[1]);
                    resolve(result);
                } catch (e) {
                    resolve({ status: 'UNKNOWN', artifacts: [], error: 'Failed to parse result' });
                }
            } else {
                resolve({ status: 'UNKNOWN', artifacts: [], error: 'No result found' });
            }
        } catch (e) {
            // Validation failed
            resolve({ status: 'FAIL', artifacts: [], error: e.message });
        }
    });
}

/**
 * Run all validations before export
 * CEO Rule: No Validation = No Artifact = No Export
 */
async function runPreExportValidations() {
    log('Running pre-export validations...');
    
    const results = {
        timestamp: new Date().toISOString(),
        validators: [],
        overallStatus: 'PASS',
        hasArtifacts: false,
        failed: [],
        passed: [],
        unknown: []
    };
    
    for (const validator of CONFIG.validators) {
        log(`  Validating: ${validator}`);
        const result = await runValidation(validator);
        
        results.validators.push({
            name: validator,
            ...result
        });
        
        if (result.status === 'PASS') {
            results.passed.push(validator);
            logSuccess(`  ${validator}: PASS`);
        } else if (result.status === 'FAIL') {
            results.failed.push(validator);
            logWarning(`  ${validator}: FAIL`);
        } else {
            results.unknown.push(validator);
            logWarning(`  ${validator}: UNKNOWN`);
        }
        
        // Track artifacts
        if (result.artifacts && result.artifacts.length > 0) {
            results.hasArtifacts = true;
        }
    }
    
    // Determine overall status
    // FAIL = still export but mark FAIL
    // If all UNKNOWN, overall is UNKNOWN
    if (results.failed.length > 0) {
        results.overallStatus = 'FAIL';
    } else if (results.unknown.length === results.validators.length) {
        results.overallStatus = 'UNKNOWN';
    } else if (results.passed.length > 0) {
        results.overallStatus = 'PASS';
    }
    
    log(`Validation complete: ${results.passed.length} passed, ${results.failed.length} failed, ${results.unknown.length} unknown`);
    
    return results;
}

/**
 * Get validation results for export
 */
function getValidationResultsForExport() {
    const reportsDir = path.join(CONFIG.sourceDir, 'validation-engine', 'reports');
    const validationFiles = [];
    
    if (fs.existsSync(reportsDir)) {
        try {
            const files = fs.readdirSync(reportsDir)
                .filter(f => f.endsWith('.md') && f.includes('_START_TEST'))
                .map(f => ({
                    name: f,
                    path: path.join(reportsDir, f),
                    mtime: fs.statSync(path.join(reportsDir, f)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);
            
            validationFiles.push(...files);
        } catch (e) {
            logWarning('Could not read validation reports: ' + e.message);
        }
    }
    
    // Also check artifact registry for validation reports
    const artifactReportsDir = path.join(CONFIG.sourceDir, 'artifact-registry');
    if (fs.existsSync(artifactReportsDir)) {
        const subdirs = ['api-proxy', 'antigravity'];
        for (const subdir of subdirs) {
            const subdirPath = path.join(artifactReportsDir, subdir);
            if (fs.existsSync(subdirPath)) {
                try {
                    const files = fs.readdirSync(subdirPath)
                        .filter(f => f.endsWith('.md'))
                        .map(f => ({
                            name: f,
                            path: path.join(subdirPath, f),
                            mtime: fs.statSync(path.join(subdirPath, f)).mtime
                        }))
                        .sort((a, b) => b.mtime - a.mtime);
                    
                    validationFiles.push(...files);
                } catch (e) {
                    // Skip
                }
            }
        }
    }
    
    return validationFiles;
}

// ============================================================================
// LIFECYCLE HANDLER
// ============================================================================

async function handleLifecycleEvent(event, options = {}) {
    log(`Lifecycle event received: ${event}`);
    log(`Trigger events: ${CONFIG.triggerEvents.join(', ')}`);
    
    // Check if this event should trigger an export
    if (!CONFIG.triggerEvents.includes(event)) {
        log(`Event '${event}' is not in trigger list - skipping export`);
        return {
            triggered: false,
            event: event,
            reason: 'not_in_trigger_list'
        };
    }
    
    // Optional: check for skip conditions
    if (options.skipReason) {
        log(`Skipping export: ${options.skipReason}`);
        return {
            triggered: false,
            event: event,
            reason: options.skipReason
        };
    }
    
    // CEO DEV 3: Run validation BEFORE export
    // NEW FLOW: Lifecycle Event -> Validation -> Artifact -> Journal -> Export
    log(`Running pre-export validation...`);
    const validationResults = await runPreExportValidations();
    
    // CEO Rule: No Artifact = No Validation = No Export
    // But we export anyway and mark the status accordingly
    if (!validationResults.hasArtifacts && validationResults.overallStatus === 'FAIL') {
        logWarning(`No artifacts found - export may be incomplete`);
    }
    
    // Run the export with validation results
    log(`Event '${event}' triggered export - running exporter...`);
    
    const exportReason = `auto-after-${event}`;
    
    try {
        const cmd = `node "${CONFIG.exporterScript}" --reason "${exportReason}" --validation-status "${validationResults.overallStatus}"`;
        execSync(cmd, { stdio: 'inherit', cwd: CONFIG.sourceDir });
        
        logSuccess(`Export completed for event: ${event}`);
        
        // Update status with lifecycle info and validation results
        updateLifecycleStatus(event, true, null, validationResults);
        
        return {
            triggered: true,
            event: event,
            reason: 'lifecycle_trigger',
            exportReason: exportReason,
            validation: validationResults
        };
    } catch (e) {
        logError(`Export failed for event ${event}: ${e.message}`);
        
        updateLifecycleStatus(event, false, e.message, validationResults);
        
        return {
            triggered: false,
            event: event,
            reason: 'export_failed',
            error: e.message,
            validation: validationResults
        };
    }
}

function updateLifecycleStatus(event, success, error = null, validationResults = null) {
    const statusPath = path.join(CONFIG.outputDir, CONFIG.statusFile);
    ensureDir(CONFIG.outputDir);
    
    try {
        const current = fs.existsSync(statusPath) 
            ? JSON.parse(fs.readFileSync(statusPath, 'utf8'))
            : {};
        
        const lifecycleEvents = current.lifecycle_events || [];
        
        // Add new event
        lifecycleEvents.unshift({
            event: event,
            timestamp: new Date().toISOString(),
            success: success,
            error: error,
            validation: validationResults ? {
                overallStatus: validationResults.overallStatus,
                passed: validationResults.passed,
                failed: validationResults.failed,
                unknown: validationResults.unknown,
                hasArtifacts: validationResults.hasArtifacts
            } : null
        });
        
        // Keep only last 50 events
        if (lifecycleEvents.length > 50) {
            lifecycleEvents.length = 50;
        }
        
        fs.writeFileSync(statusPath, JSON.stringify({
            ...current,
            lifecycle_events: lifecycleEvents,
            last_lifecycle_event: event,
            last_lifecycle_success: success,
            last_validation: validationResults ? validationResults.overallStatus : null
        }, null, 2), 'utf8');
    } catch (e) {
        logWarning('Could not update lifecycle status: ' + e.message);
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       LIFECYCLE TRIGGER - AUTO EXPORT                    ║');
    console.log('║       Task lifecycle event handler                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    let event = 'manual';
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--event' && args[i + 1]) {
            event = args[i + 1];
        }
        if (args[i] === '--skip' && args[i + 1]) {
            options.skipReason = args[i + 1];
        }
    }
    
    log(`Processing lifecycle event: ${event}`);
    
    const result = await handleLifecycleEvent(event, options);
    
    console.log('');
    console.log('Result:');
    console.log(`  Triggered: ${result.triggered}`);
    console.log(`  Event: ${result.event}`);
    console.log(`  Reason: ${result.reason}`);
    if (result.error) {
        console.log(`  Error: ${result.error}`);
    }
    if (result.validation) {
        console.log(`  Validation Status: ${result.validation.overallStatus}`);
        console.log(`  Passed: ${result.validation.passed.join(', ') || 'none'}`);
        console.log(`  Failed: ${result.validation.failed.join(', ') || 'none'}`);
        console.log(`  Unknown: ${result.validation.unknown.join(', ') || 'none'}`);
    }
    
    // Output for Agent OS parsing
    console.log('');
    console.log('--- AGENT_OS_OUTPUT ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('--- END ---');
    
    process.exit(result.triggered ? 0 : (event === 'manual' ? 0 : 1));
}

function getLifecycleStatus() {
    const statusPath = path.join(CONFIG.outputDir, CONFIG.statusFile);
    
    try {
        if (fs.existsSync(statusPath)) {
            const data = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            return {
                last_lifecycle_event: data.last_lifecycle_event,
                last_lifecycle_success: data.last_lifecycle_success,
                lifecycle_events: data.lifecycle_events || []
            };
        }
    } catch (e) {
        // Status not available
    }
    
    return {
        last_lifecycle_event: null,
        last_lifecycle_success: null,
        lifecycle_events: []
    };
}

function listTriggerEvents() {
    console.log('Supported lifecycle trigger events:');
    for (const event of CONFIG.triggerEvents) {
        const icon = '  ';
        console.log(`${icon}- ${event}`);
    }
}

// Export for module usage
module.exports = {
    handleLifecycleEvent,
    getLifecycleStatus,
    listTriggerEvents,
    CONFIG
};

// Run if executed directly
if (require.main === module) {
    main();
}
