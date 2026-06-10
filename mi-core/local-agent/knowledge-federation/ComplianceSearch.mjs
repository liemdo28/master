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
const COMPLIANCE_ROOT = 'E:/Project/Master/.local-agent-global/reference-brain/us-business-compliance';

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