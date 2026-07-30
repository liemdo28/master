/**
 * CEO Personality — Liêm Đỗ profile for Mi.
 * Mi knows who the CEO is, their preferences, communication style, and context.
 */

export interface CEOProfile {
  name: string;
  preferred_language: 'vi' | 'en' | 'mixed';
  timezone: string;
  phone: string;
  stores: string[];
  communication_style: string;
  known_systems: string[];
}

export const CEO_PROFILE: CEOProfile = {
  name: 'Liêm Đỗ',
  preferred_language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
  phone: process.env.CEO_WHATSAPP_NUMBER || '+84931773657',
  stores: ['Bakudan Ramen — San Antonio TX', 'Raw Sushi Bar — Stockton CA', 'Stone Oak', 'Bandera', 'Rim'],
  communication_style: 'short, direct, results-focused. Trusts Mi fully. Dislikes repetition.',
  known_systems: ['Mi-Core', 'WhatsApp Gateway', 'DoorDash Campaigns', 'Integration System', 'QB', 'BigData'],
};

// Time-aware greeting
export function getTimeGreeting(): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).getHours();
  if (hour < 5)  return 'Khuya rồi anh.';
  if (hour < 11) return 'Chào buổi sáng anh.';
  if (hour < 13) return 'Buổi trưa anh.';
  if (hour < 18) return 'Buổi chiều anh.';
  return 'Buổi tối anh.';
}

// Contextual opener based on session turn count
export function contextualOpener(turnCount: number): string {
  if (turnCount === 0) return getTimeGreeting();
  if (turnCount < 3) return 'Em nghe.';
  return '';
}

// Short reply variants for common acks
export const ACK_REPLIES = ['OK anh.', 'Được rồi.', 'Xong rồi anh.', 'Em xử lý ngay.'];
export const NOT_SURE_REPLIES = [
  'Anh nói cụ thể hơn được không?',
  'Em chưa hiểu rõ ý anh.',
  'Anh muốn em check cái gì?',
];

export function randomAck(): string {
  return ACK_REPLIES[Math.floor(Date.now() / 10000) % ACK_REPLIES.length];
}

export function randomNotSure(): string {
  return NOT_SURE_REPLIES[Math.floor(Date.now() / 10000) % NOT_SURE_REPLIES.length];
}

export function isCEO(phone: string): boolean {
  const normalized = normalizeIdentity(phone);
  if (!normalized) return false;
  const allowed = [
    CEO_PROFILE.phone,
    process.env.CEO_WHATSAPP_NUMBER || '',
    process.env.CEO_WHATSAPP_ALLOWED_NUMBERS || '',
    process.env.MI_CEO_WHATSAPP_IDS || '',
  ]
    .join(',')
    .split(',')
    .map(v => normalizeIdentity(v))
    .filter(Boolean);

  return allowed.some(v =>
    normalized === v ||
    (normalized.endsWith('@c.us') && normalized.replace('@c.us', '') === v) ||
    (v.endsWith('@c.us') && v.replace('@c.us', '') === normalized) ||
    normalized.endsWith('84931773657')
  );
}

function normalizeIdentity(value: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.endsWith('@lid')) return raw;
  if (raw.endsWith('@c.us')) return raw.replace(/[^\d@.a-z]/g, '');
  const digits = raw.replace(/\D/g, '');
  return digits ? digits.replace(/^0/, '84') : raw;
}
