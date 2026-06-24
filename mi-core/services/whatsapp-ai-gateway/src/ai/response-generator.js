const kb = require('./knowledge-base');

const CANNED = {
  greeting: [
    "Hello! 👋 Welcome to Bakudan Ramen. How can I help you today?",
    "Hi there! Thanks for reaching out to Bakudan Ramen. What can I do for you? 🍜",
  ],
  reservation: [
    "📅 To reserve a table, please let us know:\n1. Location (Bandera / Stone Oak / Medical Center)\n2. Date & time\n3. Number of guests\n4. Your name & phone\n\nWe'll confirm within 30 minutes. See you soon! 🙏",
  ],
  complaint: [
    "We're really sorry to hear that! 😔 Your feedback matters to us.\n\nOur manager will follow up with you shortly. Thank you for letting us know — we want to make this right.",
  ],
  unknown: [
    "Thank you for your message! 🙏 Our team will get back to you shortly.\n\nFor urgent matters, please call us directly.",
    "Thanks for reaching out! We'll have someone respond to you soon. 😊",
  ],
};

// Confidence scoring (0–100). Used by escalation engine.
const CONFIDENCE = {
  greeting: 95, hours: 90, address: 90, menu: 88,
  rewards: 88, reservation: 75, complaint: 60, unknown: 20,
};

function getConfidence(intent) {
  return CONFIDENCE[intent] ?? 20;
}

function generateResponse(intent, originalText = '') {
  // Knowledge-base responses take priority over canned ones
  switch (intent) {
    case 'hours': {
      const store = kb.detectStore(originalText);
      if (store) {
        return `🕐 ${kb.getHoursText(store)}`;
      }
      // No specific store detected — show all
      const allHours = kb.getAllStoresText();
      return allHours
        ? `🕐 Here are our current hours:\n\n${allHours}`
        : "We're open Mon–Fri 11 AM–10 PM and Sat–Sun 10 AM–11 PM. Times may vary by location.";
    }
    case 'address': {
      const store = kb.detectStore(originalText);
      if (store) {
        return `📍 *${store.full_name}*\n${store.address}\n📞 ${store.phone}\n\nGoogle Maps: ${store.google_maps}`;
      }
      const data = kb.getAllStoresText();
      return data
        ? `📍 *Our Locations:*\n\n${data}`
        : "We have three locations in San Antonio. Ask us about Bandera, Stone Oak, or Medical Center!";
    }
    case 'menu': {
      const menuText = kb.getMenuText();
      return menuText || "🍜 We serve a variety of ramen bowls, appetizers, and drinks. Ask us about specific items!";
    }
    case 'rewards': {
      const rewardsText = kb.getRewardsText();
      return rewardsText || "⭐ Join Bakudan Rewards and earn points with every visit! Ask staff to sign you up.";
    }
    default: {
      // Try FAQ search for unknown/other intents
      if (intent === 'unknown' && originalText) {
        const faqAnswer = kb.searchFaq(originalText);
        if (faqAnswer) return faqAnswer;
      }
      const pool = CANNED[intent] || CANNED.unknown;
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
}

module.exports = { generateResponse, getConfidence };
