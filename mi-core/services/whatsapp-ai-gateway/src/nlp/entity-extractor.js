function extractEntities(text) {
  const raw = String(text || '').trim();
  const entities = {};
  const temp = raw.match(/(-?\d+(?:[.,]\d+)?)\s*(?:°\s*)?([fc])?\b/i);
  if (temp) {
    entities.temperature = Number(temp[1].replace(',', '.'));
    entities.unit = temp[2] ? temp[2].toUpperCase() : null;
  }
  const storeText = raw.toLowerCase();
  if (storeText.includes('rim')) entities.store = 'Rim';
  if (storeText.includes('stone oak') || storeText.includes('stoneoak')) entities.store = 'Stone Oak';
  if (storeText.includes('bandera')) entities.store = 'Bandera';
  return entities;
}

module.exports = { extractEntities };
