/**
 * DatasetCatalog — TypeScript port of DatasetCatalog.mjs
 */

import fs from 'fs';
import path from 'path';

const CATALOG_DIR = path.join(process.cwd(), '.local-agent-global', 'data-analyst');
const CATALOG_FILE = path.join(CATALOG_DIR, 'catalog.json');

export interface DatasetEntry {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  row_count: number;
  headers: string[];
  mapping: Record<string, string>;
  quality_score: number;
  ingested_at: string;
  last_analysis?: string;
}

export interface AnalysisReport {
  dataset_id: string;
  dataset_name: string;
  analysis_type: string;
  result: unknown;
  created_at: string;
}

function ensureDir() {
  if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });
}

function loadCatalog(): DatasetEntry[] {
  ensureDir();
  if (!fs.existsSync(CATALOG_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8')); }
  catch { return []; }
}

function saveCatalog(entries: DatasetEntry[]) {
  ensureDir();
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export function addDataset(entry: Omit<DatasetEntry, 'id' | 'ingested_at'>): DatasetEntry {
  const entries = loadCatalog();
  const existing = entries.findIndex(e => e.file_path === entry.file_path);
  const now = new Date().toISOString();
  const newEntry: DatasetEntry = {
    ...entry,
    id: existing >= 0 ? entries[existing].id : `ds_${Date.now()}`,
    ingested_at: existing >= 0 ? entries[existing].ingested_at : now,
  };
  if (existing >= 0) entries[existing] = newEntry;
  else entries.push(newEntry);
  saveCatalog(entries);
  return newEntry;
}

export function listDatasets(): DatasetEntry[] {
  return loadCatalog();
}

export function getDataset(id: string): DatasetEntry | null {
  return loadCatalog().find(e => e.id === id) || null;
}

export function saveAnalysisReport(report: Omit<AnalysisReport, 'created_at'>): string {
  ensureDir();
  const fileName = `analysis_${report.dataset_id}_${Date.now()}.json`;
  const filePath = path.join(CATALOG_DIR, fileName);
  const full: AnalysisReport = { ...report, created_at: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(full, null, 2), 'utf-8');

  const entries = loadCatalog();
  const idx = entries.findIndex(e => e.id === report.dataset_id);
  if (idx >= 0) { entries[idx].last_analysis = full.created_at; saveCatalog(entries); }

  return filePath;
}

export function getLastAnalysis(datasetId: string): AnalysisReport | null {
  ensureDir();
  const files = fs.readdirSync(CATALOG_DIR)
    .filter(f => f.startsWith(`analysis_${datasetId}_`) && f.endsWith('.json'))
    .sort();
  if (files.length === 0) return null;
  try { return JSON.parse(fs.readFileSync(path.join(CATALOG_DIR, files[files.length - 1]), 'utf-8')); }
  catch { return null; }
}
