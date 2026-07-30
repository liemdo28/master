/**
 * store-context.ts
 * TypeScript store + people context resolution for pipeline.
 * Mirrors local-agent/federated-memory but as TypeScript for server use.
 */

const STORE_ALIASES: Record<string, string> = {
  'raw': 'raw-sushi', 'sushi': 'raw-sushi', 'rawsushi': 'raw-sushi',
  'raw sushi': 'raw-sushi', 'raw sushi bar': 'raw-sushi', 'rawsushibar': 'raw-sushi',
  'bakudan': 'bakudan', 'ramen': 'bakudan', 'bakudan ramen': 'bakudan', 'bakudanramen': 'bakudan',
};

const STORES: Record<string, {
  id: string; name: string; city: string; state: string;
  website: string; manager: string; timezone: string;
  hashtags: string[]; seo_keywords: string[];
  compliance_jurisdiction: string; best_post_time: string;
}> = {
  'raw-sushi': {
    id: 'raw-sushi', name: 'Raw Sushi Bar',
    city: 'Stockton', state: 'CA',
    website: 'rawsushibar.com', manager: 'Maria',
    timezone: 'America/Los_Angeles',
    hashtags: ['#RawSushi', '#StocktonFood', '#SushiLovers'],
    seo_keywords: ['sushi stockton', 'best sushi stockton ca'],
    compliance_jurisdiction: 'California', best_post_time: 'Friday 10AM PT',
  },
  'bakudan': {
    id: 'bakudan', name: 'Bakudan Ramen',
    city: 'San Antonio', state: 'TX',
    website: 'bakudanramen.com', manager: 'Maria',
    timezone: 'America/Chicago',
    hashtags: ['#BakudanRamen', '#StocktonRamen', '#RamenLovers'],
    seo_keywords: ['ramen stockton', 'best ramen stockton ca'],
    compliance_jurisdiction: 'Texas', best_post_time: 'Thursday 11AM PT',
  },
};

export interface StoreContext {
  id: string; name: string; city: string; state: string;
  website: string; manager: string; timezone: string;
  hashtags: string[]; seo_keywords: string[];
  compliance_jurisdiction: string; best_post_time: string;
}

export function resolveStore(text: string): StoreContext | null {
  const t = text.toLowerCase();
  for (const [alias, id] of Object.entries(STORE_ALIASES)) {
    if (t.includes(alias)) return STORES[id] || null;
  }
  return null;
}

export function getStore(id: string): StoreContext | null {
  return STORES[id] || null;
}

export function getStoreContextString(id: string): string {
  const s = STORES[id];
  if (!s) return '';
  return `${s.name} | ${s.city}, ${s.state} | ${s.website} | Mgr: ${s.manager} | ${s.compliance_jurisdiction}`;
}

export function answerStoreQuery(message: string): string | null {
  const store = resolveStore(message);
  if (!store) return null;
  return [
    `**${store.name}**`,
    `📍 ${store.city}, ${store.state}`,
    `🌐 ${store.website}`,
    `👤 Manager: ${store.manager}`,
    `🕐 Timezone: ${store.timezone}`,
    `⚖️ Compliance: ${store.compliance_jurisdiction}`,
    `📱 Best post: ${store.best_post_time}`,
    `#️⃣ ${store.hashtags.slice(0, 3).join(' ')}`,
  ].join('\n');
}

// People context
const KNOWN_PEOPLE: Record<string, { name: string; role: string; stores: string[] }> = {
  'maria':  { name: 'Maria',  role: 'Manager / Dashboard admin', stores: ['raw-sushi', 'bakudan'] },
  'hoang':  { name: 'Hoang',  role: 'Operations', stores: ['raw-sushi'] },
  'nguyen': { name: 'Nguyên', role: 'Staff', stores: ['raw-sushi', 'bakudan'] },
  'nguyên': { name: 'Nguyên', role: 'Staff', stores: ['raw-sushi', 'bakudan'] },
};

export function resolvePerson(text: string) {
  const t = text.toLowerCase();
  for (const [key, person] of Object.entries(KNOWN_PEOPLE)) {
    if (t.includes(key)) return person;
  }
  return null;
}
