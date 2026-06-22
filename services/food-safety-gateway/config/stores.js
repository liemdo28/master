// Store registry for the Bakudan Food Safety pilot.
// Selection keys map to canonical store records.

export const STORES = Object.freeze({
  '1': { id: 'rim', name: 'Rim' },
  '2': { id: 'stone_oak', name: 'Stone Oak' },
  '3': { id: 'bandera', name: 'Bandera' },
});

/**
 * Resolve a store from a raw user selection (e.g. "1", " 2 ", "3").
 * Returns null when the input is not a valid selection key.
 * @param {string} input
 */
export function resolveStore(input) {
  if (input == null) return null;
  const key = String(input).trim();
  return STORES[key] || null;
}

/**
 * Human-readable list used in the WhatsApp store-selection prompt.
 */
export function storeSelectionPrompt() {
  const lines = Object.entries(STORES).map(([key, store]) => `${key} ${store.name}`);
  return [
    'Welcome to the Bakudan Food Safety Gateway.',
    '',
    'Which store are you submitting for?',
    ...lines,
    '',
    'Reply with the number (1, 2, or 3).',
  ].join('\n');
}
