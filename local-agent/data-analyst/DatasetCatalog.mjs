/**
 * DatasetCatalog — persistent registry of imported datasets.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CATALOG_DIR = path.join(GLOBAL_DIR, 'data-analyst');
const CATALOG_FILE = path.join(CATALOG_DIR, 'dataset_catalog.json');
const DATASETS_DIR = path.join(CATALOG_DIR, 'datasets');

function ensureDirs() {
  fs.mkdirSync(CATALOG_DIR, { recursive: true });
  fs.mkdirSync(DATASETS_DIR, { recursive: true });
}

function loadCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
  } catch {
    return { datasets: [], last_updated: null };
  }
}

function saveCatalog(catalog) {
  ensureDirs();
  catalog.last_updated = new Date().toISOString();
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
}

export function addDataset(meta) {
  ensureDirs();
  const catalog = loadCatalog();

  const id = meta.dataset_id || `ds_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const entry = {
    dataset_id: id,
    source_type: meta.source_type || 'local_file',
    source_path: meta.source_path || '',
    file_name: meta.file_name || '',
    file_type: meta.file_type || '',
    imported_at: new Date().toISOString(),
    modified_at: meta.modified_at || new Date().toISOString(),
    row_count: meta.row_count || 0,
    column_count: meta.column_count || 0,
    detected_columns: meta.detected_columns || [],
    confidence: meta.confidence || 0,
    store: meta.store || '',
    period: meta.period || '',
    tags: meta.tags || [],
    mapping: meta.mapping || {},
    quality_score: meta.quality_score || 0,
  };

  // Remove old version if same source
  catalog.datasets = catalog.datasets.filter(d => d.source_path !== entry.source_path);
  catalog.datasets.unshift(entry);

  // Keep max 100 datasets
  if (catalog.datasets.length > 100) catalog.datasets = catalog.datasets.slice(0, 100);

  saveCatalog(catalog);
  return entry;
}

export function getDataset(id) {
  return loadCatalog().datasets.find(d => d.dataset_id === id) || null;
}

export function getAllDatasets() {
  return loadCatalog().datasets;
}

export function searchDatasets(query) {
  const q = query.toLowerCase();
  return loadCatalog().datasets.filter(d =>
    d.file_name?.toLowerCase().includes(q) ||
    d.store?.toLowerCase().includes(q) ||
    d.tags?.some(t => t.toLowerCase().includes(q)) ||
    d.period?.toLowerCase().includes(q)
  );
}

export function getLatestDataset(storeFilter = null) {
  let datasets = loadCatalog().datasets;
  if (storeFilter) {
    datasets = datasets.filter(d => d.store?.toLowerCase().includes(storeFilter.toLowerCase()));
  }
  return datasets[0] || null;
}

export function deleteDataset(id) {
  const catalog = loadCatalog();
  catalog.datasets = catalog.datasets.filter(d => d.dataset_id !== id);
  saveCatalog(catalog);
}

export function saveAnalysisReport(datasetId, analysis) {
  ensureDirs();
  const reportPath = path.join(DATASETS_DIR, `${datasetId}_analysis.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ dataset_id: datasetId, generated_at: new Date().toISOString(), ...analysis }, null, 2));

  // Also update last_analysis.json
  fs.writeFileSync(path.join(CATALOG_DIR, 'last_analysis.json'), JSON.stringify({
    dataset_id: datasetId, generated_at: new Date().toISOString(), summary: analysis.summary || {},
  }, null, 2));
}

export function getLastAnalysis() {
  try {
    return JSON.parse(fs.readFileSync(path.join(CATALOG_DIR, 'last_analysis.json'), 'utf-8'));
  } catch { return null; }
}
