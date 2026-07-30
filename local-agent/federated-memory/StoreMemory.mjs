/**
 * StoreMemory.mjs
 * Knows everything about Raw Sushi Bar & Bakudan Ramen.
 * Resolves "Raw" → full store context, "Bakudan" → full store context.
 */

const STORES = {
  'raw-sushi': {
    id: 'raw-sushi',
    aliases: ['raw', 'raw sushi', 'rawsushi', 'raw sushi bar', 'sushi', 'rawsushibar'],
    name: 'Raw Sushi Bar',
    city: 'Stockton',
    state: 'CA',
    country: 'USA',
    region: 'Central Valley, California',
    website: 'rawsushibar.com',
    website_alt: 'rawsushi.com',
    git_repo: 'liemdo28/rawwebsite',
    dashboard_link: 'http://dashboard.bakudanramen.com',
    manager: 'Maria',
    cuisine: 'Japanese / Sushi',
    timezone: 'America/Los_Angeles',
    social_handles: { instagram: '@rawsushibar_stockton' },
    seo_keywords: ['sushi stockton', 'best sushi stockton ca', 'sushi bar stockton'],
    hashtags: ['#RawSushi', '#StocktonFood', '#SushiLovers', '#CentralValleyEats'],
    target_customers: 'young professionals, foodies, families in Stockton area',
    peak_seasons: ['summer', 'Valentine\'s Day', 'Mother\'s Day', 'Father\'s Day'],
    best_post_time: 'Friday 10AM PT',
    tone: 'fresh, clean, upscale casual',
    projects: ['RawWebsite', 'raw-sushi-website'],
    compliance_jurisdiction: 'California',
  },
  'bakudan': {
    id: 'bakudan',
    aliases: ['bakudan', 'bakudan ramen', 'bakudanramen', 'ramen', 'bakudan ramen san antonio'],
    name: 'Bakudan Ramen',
    city: 'San Antonio',
    state: 'TX',
    country: 'USA',
    region: 'San Antonio, Texas',
    website: 'bakudanramen.com',
    git_repo: 'liemdo28/bakudan-website',
    dashboard_link: 'http://dashboard.bakudanramen.com',
    manager: 'Maria',
    cuisine: 'Japanese / Ramen',
    timezone: 'America/Chicago',
    social_handles: { instagram: '@bakudanramen' },
    seo_keywords: ['ramen stockton', 'best ramen stockton ca', 'bakudan ramen'],
    hashtags: ['#BakudanRamen', '#StocktonRamen', '#RamenLovers', '#StocktonFoodies'],
    target_customers: 'ramen lovers, students, young adults in Stockton area',
    peak_seasons: ['winter', 'fall', 'Lunar New Year', 'Halloween'],
    best_post_time: 'Thursday 11AM PT',
    tone: 'bold, fun, energetic',
    projects: ['BakudanWebsite', 'bakudan-website'],
    compliance_jurisdiction: 'Texas',
  },
};

export class StoreMemory {
  /** Resolve a string mention to a store */
  static resolve(text) {
    if (!text) return null;
    const t = text.toLowerCase().trim();
    for (const store of Object.values(STORES)) {
      if (store.aliases.some(a => t.includes(a))) return store;
    }
    return null;
  }

  /** Get store by ID */
  static get(id) {
    return STORES[id] || null;
  }

  /** Get all stores */
  static getAll() {
    return Object.values(STORES);
  }

  /** Get store context string for AI */
  static getContextString(storeId) {
    const s = STORES[storeId];
    if (!s) return '';
    return [
      `Store: ${s.name}`,
      `Location: ${s.city}, ${s.state}`,
      `Website: ${s.website}`,
      `Manager: ${s.manager}`,
      `Compliance: ${s.compliance_jurisdiction}`,
      `SEO: ${s.seo_keywords.slice(0, 3).join(', ')}`,
      `Best post time: ${s.best_post_time}`,
    ].join(' | ');
  }

  /** Answer "Raw là store nào?" / "Bakudan ở đâu?" */
  static answerStoreQuery(text) {
    const store = this.resolve(text);
    if (!store) return null;
    return {
      store,
      answer: [
        `**${store.name}**`,
        `📍 ${store.city}, ${store.state} — ${store.region}`,
        `🌐 ${store.website}`,
        `👤 Manager: ${store.manager}`,
        `🕐 Timezone: ${store.timezone}`,
        `#️⃣ ${store.hashtags.slice(0, 3).join(' ')}`,
        `📋 Compliance: ${store.compliance_jurisdiction}`,
      ].join('\n'),
    };
  }
}
