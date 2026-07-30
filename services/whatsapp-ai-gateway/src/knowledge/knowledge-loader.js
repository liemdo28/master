const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('./knowledge');

function loadKnowledge(relativePath) {
  const fullPath = path.resolve(ROOT, relativePath);
  if (!fullPath.startsWith(ROOT + path.sep)) {
    throw new Error('Knowledge path must stay inside the knowledge directory');
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function listKnowledgeDomains() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

module.exports = { loadKnowledge, listKnowledgeDomains, ROOT };
