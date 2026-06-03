#!/usr/bin/env node
/**
 * Validation Engine CLI
 * CEO Directive - CLI interface for validation engine
 * 
 * Usage:
 *   node cli.js "Validate API Proxy"
 *   node cli.js "Validate Antigravity"
 *   node cli.js "Validate Agent OS"
 *   node cli.js "Run All Validations"
 */

const path = require('path');
const fs = require('fs');
const { validate, generateReport } = require('./validator');

const VALIDATION_ENGINE_DIR = __dirname;
const REPORTS_DIR = path.join(VALIDATION_ENGINE_DIR, 'reports');

function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

function parseCommand(input) {
    // Normalize input
    const normalized = input.toLowerCase().trim();
    
    // Parse validation commands
    if (normalized.includes('validate') || normalized.includes('validation')) {
        if (normalized.includes('api') && normalized.includes('proxy')) {
            return 'api-proxy';
        }
        if (normalized.includes('antigravity') || normalized.includes('cline')) {
            return 'antigravity';
        }
        if (normalized.includes('agent') && normalized.includes('os')) {
            return 'agent-os';
        }
        if (normalized.includes('all')) {
            return 'ALL';
        }
    }
    
    return null;
}

async function runValidation(validatorName) {
    console.log('');
    console.log(`[Validation Engine] Starting validation: ${validatorName}`);
    
    const result = await validate(validatorName);
    const report = generateReport(result, result.taskId, validatorName);
    
    console.log(`[Validation Engine] Status: ${result.status}`);
    console.log(`[Validation Engine] Task ID: ${result.taskId}`);
    
    if (report.mdPath) {
        console.log(`[Validation Engine] Report: ${report.mdPath}`);
    }
    
    return result;
}

async function runAllValidations() {
    const validators = ['api-proxy', 'antigravity', 'agent-os'];
    const results = [];
    
    console.log('');
    console.log('========================================');
    console.log('  RUNNING ALL VALIDATIONS');
    console.log('========================================');
    console.log('');
    
    for (const validator of validators) {
        const result = await runValidation(validator);
        results.push(result);
        console.log('');
    }
    
    // Summary
    console.log('========================================');
    console.log('  VALIDATION SUMMARY');
    console.log('========================================');
    console.log('');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const unknown = results.filter(r => r.status === 'UNKNOWN').length;
    
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Unknown: ${unknown}`);
    console.log('');
    
    for (const result of results) {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`  ${icon} ${result.validator}: ${result.status}`);
    }
    
    return results;
}

async function main() {
    ensureReportsDir();
    
    // Get command from arguments
    const args = process.argv.slice(2);
    const command = args.join(' ') || 'help';
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       VALIDATION ENGINE CLI                      ║');
    console.log('║       CEO Directive - DEV 3                       ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    
    if (command === 'help' || command === '--help' || command === '-h') {
        console.log('Usage:');
        console.log('  node cli.js "Validate API Proxy"');
        console.log('  node cli.js "Validate Antigravity"');
        console.log('  node cli.js "Validate Agent OS"');
        console.log('  node cli.js "Run All Validations"');
        console.log('');
        console.log('Available validators:');
        console.log('  - api-proxy: Validates API Proxy startup and health');
        console.log('  - antigravity: Validates Antigravity IDE integration');
        console.log('  - agent-os: Validates Agent OS core functionality');
        console.log('');
        process.exit(0);
    }
    
    const validatorName = parseCommand(command);
    
    if (!validatorName) {
        console.error(`[Validation Engine] Unknown command: ${command}`);
        console.error('Run "node cli.js help" for usage.');
        process.exit(1);
    }
    
    let results;
    
    if (validatorName === 'ALL') {
        results = await runAllValidations();
    } else {
        const result = await runValidation(validatorName);
        results = [result];
    }
    
    // Output final result in expected format
    console.log('');
    console.log('--- RESULT ---');
    console.log(JSON.stringify({
        status: results[0]?.status || 'UNKNOWN',
        artifacts: results[0]?.artifacts || [],
        taskId: results[0]?.taskId || null,
        validator: results[0]?.validator || validatorName
    }, null, 2));
    
    // Exit with appropriate code
    const overallStatus = results.every(r => r.status === 'PASS') ? 0 :
                         results.some(r => r.status === 'FAIL') ? 1 : 2;
    process.exit(overallStatus);
}

// Export for module usage
module.exports = {
    runValidation,
    runAllValidations,
    parseCommand
};

// Run if executed directly
if (require.main === module) {
    main().catch(err => {
        console.error('[Validation Engine] Error:', err.message);
        process.exit(1);
    });
}
