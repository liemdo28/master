const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.resolve('./data/templates');
const DEFAULT_TEMPLATE_ID = 'daily-entry-v1';

function templatePath(templateId = DEFAULT_TEMPLATE_ID) {
  const safeId = String(templateId || DEFAULT_TEMPLATE_ID).replace(/[^a-zA-Z0-9._-]/g, '');
  const filename = safeId === DEFAULT_TEMPLATE_ID ? 'daily-entry-template-v1.json' : `${safeId}.json`;
  return path.join(TEMPLATE_DIR, filename);
}

function registerTemplate(definition) {
  if (!definition || !definition.template_id) throw new Error('template_id required');
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  const file = templatePath(definition.template_id);
  fs.writeFileSync(file, JSON.stringify(normalizeDefinition(definition), null, 2));
  return file;
}

function getTemplate(templateId = DEFAULT_TEMPLATE_ID) {
  const file = templatePath(templateId);
  if (!fs.existsSync(file)) return null;
  return normalizeDefinition(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function getDefaultTemplate() {
  return getTemplate(DEFAULT_TEMPLATE_ID);
}

function listTemplates() {
  if (!fs.existsSync(TEMPLATE_DIR)) return [];
  return fs.readdirSync(TEMPLATE_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      try { return JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8')); }
      catch (_) { return null; }
    })
    .filter(Boolean)
    .map(normalizeDefinition);
}

function normalizeDefinition(def) {
  return {
    template_id: def.template_id || DEFAULT_TEMPLATE_ID,
    template_name: def.template_name || 'Daily Entry Template',
    version: def.version || '1.0',
    page_size: def.page_size || { width: 900, height: 1200, unit: 'pt' },
    form_id: def.form_id || def.template_id || DEFAULT_TEMPLATE_ID,
    marker_positions: def.marker_positions || {},
    cell_coordinates: def.cell_coordinates || {},
    item_mapping: def.item_mapping || {},
    source_sheet_version: def.source_sheet_version || '',
    fields: Array.isArray(def.fields) ? def.fields : [],
    generated_at: def.generated_at || null,
  };
}

module.exports = {
  DEFAULT_TEMPLATE_ID,
  TEMPLATE_DIR,
  templatePath,
  registerTemplate,
  getTemplate,
  getDefaultTemplate,
  listTemplates,
};
