/**
 * ComplianceSearch — fast US Business Compliance DB search
 * 
 * Searches: .local-agent-global/reference-brain/us-business-compliance/
 * Categories: federal, california, texas, stockton, san-antonio,
 *             labor-law, payroll, tax, food-safety, permits, accounting
 * 
 * NEVER fakes data. Returns source + timestamp + confidence + disclaimer.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path fallback chain for US Compliance DB
function resolveComplianceRoot() {
  if (process.env.MI_REFERENCE_BRAIN_PATH) {
    const p = process.env.MI_REFERENCE_BRAIN_PATH;
    if (fs.existsSync(p)) return p;
  }
  // B. mi-core root (3 levels up from this file: local-agent/knowledge-federation/ -> mi-core/)
  const miCoreRoot = path.resolve(__dirname, '..', '..');
  const miCorePath = path.join(miCoreRoot, '.local-agent-global', 'reference-brain', 'us-business-compliance');
  if (fs.existsSync(miCorePath)) return miCorePath;
  // C. workspace root
  const masterRoot = path.resolve(miCoreRoot, '..');
  const masterPath = path.join(masterRoot, '.local-agent-global', 'reference-brain', 'us-business-compliance');
  if (fs.existsSync(masterPath)) return masterPath;
  // D. GLOBAL_DIR
  if (process.env.GLOBAL_DIR) {
    const gPath = path.join(process.env.GLOBAL_DIR, 'reference-brain', 'us-business-compliance');
    if (fs.existsSync(gPath)) return gPath;
  }
  return null;
}

const COMPLIANCE_ROOT = resolveComplianceRoot();

const JURISDICTION_MAP = {
  california:  ['california', 'stockton', 'labor-law', 'payroll', 'food-safety', 'permits'],
  texas:        ['texas', 'san-antonio', 'tax', 'accounting'],
  stockton:     ['stockton', 'california', 'labor-law'],
  'san antonio': ['san-antonio', 'texas', 'tax'],
  federal:      ['federal'],
  us:           ['federal'],
};

const CATEGORIES = [
  'federal', 'california', 'texas', 'stockton', 'san-antonio',
  'labor-law', 'payroll', 'tax', 'food-safety', 'permits',
  'accounting', 'restaurant-operations', 'reports',
];

function searchDir(dirPath, query, results = [], maxResults = 20) {
  if (results.length >= maxResults) return results;
  try {