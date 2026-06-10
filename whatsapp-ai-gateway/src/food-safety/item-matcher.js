const fs = require('fs');
const path = require('path');

const ALIASES_FILE = path.resolve('./knowledge/food-safety/item-aliases.json');
let aliasesCache = null;

function loadAliases() {
  if (aliasesCache) return aliasesCache;
  try {
    const data = JSON.parse(fs.readFileSync(ALIASES_FILE, 'utf8'));
    aliasesCache = data.aliases || {};
  } catch (_) {
    aliasesCache = {};
  }
  return aliasesCache;
}

function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/photo/g, '')
    .replace(/°f|degrees fahrenheit|fahrenheit/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

module.exports = { loadAliases, normalizeLabel };
