/**
 * Shared Config Loader
 * - Loads location, keyword, page, directory data from JSON files.
 * - Resolves env vars from each agent's .env (no hardcoded business data).
 */
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = __dirname;

function loadJson(name) {
  const p = path.join(CONFIG_DIR, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const locations = loadJson('locations.json');
const keywords = loadJson('keywords.json');
const pages = loadJson('pages.json');
const directories = loadJson('directories.json');

function resolveSharedDbPath() {
  return (
    process.env.SEO_SHARED_DB_PATH ||
    path.join(__dirname, '..', 'database', 'seo-shared.db')
  );
}

function resolveSharedConfigPath() {
  return process.env.SEO_SHARED_CONFIG_PATH || CONFIG_DIR;
}

function resolveSharedRoot() {
  return path.join(__dirname, '..');
}

module.exports = {
  CONFIG_DIR,
  locations,
  keywords,
  pages,
  directories,
  resolveSharedDbPath,
  resolveSharedConfigPath,
  resolveSharedRoot,
};
