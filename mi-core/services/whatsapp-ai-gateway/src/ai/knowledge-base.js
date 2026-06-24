const path = require('path');

const KB_DIR = path.resolve('./knowledge');

function load(file) {
  try {
    return require(path.join(KB_DIR, file));
  } catch (_) {
    return null;
  }
}

// Detect which store(s) are mentioned in a message
function detectStore(text) {
  const stores = load('stores.json');
  if (!stores) return null;
  const lower = text.toLowerCase();
  for (const store of stores.stores) {
    if (store.aliases.some(a => lower.includes(a))) return store;
  }
  return null;
}

// Get hours for a store (optionally for today's day)
function getHoursText(store) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today = days[new Date().getDay()];
  const h = store.hours[today];
  const allSame = Object.values(store.hours).every(v => v.open === h.open && v.close === h.close);

  if (allSame) {
    return `${store.full_name} is open daily ${h.open} – ${h.close}.`;
  }

  const lines = Object.entries(store.hours)
    .map(([d, v]) => `  • ${d.charAt(0).toUpperCase() + d.slice(1)}: ${v.open} – ${v.close}`)
    .join('\n');
  return `*${store.full_name}* hours:\n${lines}\n\nToday (${today.charAt(0).toUpperCase() + today.slice(1)}): ${h.open} – ${h.close}`;
}

// Build a menu summary text
function getMenuText() {
  const data = load('menu.json');
  if (!data) return null;
  const popular = data.categories
    .flatMap(c => c.items)
    .filter(i => i.popular)
    .map(i => `  • ${i.name} — $${i.price.toFixed(2)}`)
    .join('\n');
  return `🍜 *Popular Items*\n${popular}\n\nFull menu available in-store or on our website.`;
}

// Build rewards summary
function getRewardsText() {
  const data = load('rewards.json');
  if (!data) return null;
  const tiers = data.tiers.map(t => `  • *${t.name}* (${t.min_points}+ pts): ${t.perks.join(', ')}`).join('\n');
  const redeem = data.redemption.slice(0, 3).map(r => `  • ${r.points} pts → ${r.reward}`).join('\n');
  return `⭐ *${data.program_name}*\n${data.earning.rate}\n\n*Tiers*\n${tiers}\n\n*Redeem*\n${redeem}`;
}

// Search FAQ
function searchFaq(text) {
  const data = load('faq.json');
  if (!data) return null;
  const lower = text.toLowerCase();
  const match = data.faqs.find(f => f.tags.some(t => lower.includes(t)));
  return match ? match.answer : null;
}

// All stores hours overview
function getAllStoresText() {
  const data = load('stores.json');
  if (!data) return null;
  return data.stores.map(s => {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const today = days[new Date().getDay()];
    const h = s.hours[today];
    return `📍 *${s.name}*\n${s.address}\nToday: ${h.open} – ${h.close}\n📞 ${s.phone}`;
  }).join('\n\n');
}

module.exports = { detectStore, getHoursText, getMenuText, getRewardsText, searchFaq, getAllStoresText };
