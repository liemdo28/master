/**
 * OwnerProfileMemory.mjs
 * CEO/Owner profile — always available, drives Mi's executive context.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR    = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const PROFILE_PATH  = path.join(GLOBAL_DIR, 'executive-memory-v2', 'owner_profile.json');

export class OwnerProfileMemory {
  static get() {
    try { return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8')); }
    catch { return null; }
  }

  static getPreferredName() { return this.get()?.preferred_name || 'anh'; }
  static getTimezone()      { return this.get()?.timezone || 'America/Los_Angeles'; }
  static getCity()          { return this.get()?.city || 'Stockton'; }
  static getBusinesses()    { return this.get()?.businesses || ['Raw Sushi Bar', 'Bakudan Ramen']; }

  static update(updates) {
    const profile = this.get() || {};
    const updated = { ...profile, ...updates, updated_at: new Date().toISOString() };
    fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true });
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(updated, null, 2));
    return updated;
  }

  static getSummary() {
    const p = this.get();
    if (!p) return 'Owner profile not found';
    return [
      `CEO: ${p.preferred_name || 'anh'} — ${p.full_role}`,
      `📍 ${p.city}, ${p.state}`,
      `🏢 ${p.businesses?.join(' & ')}`,
      `🕐 ${p.timezone}`,
      `💬 Style: ${p.communication_style}`,
    ].join('\n');
  }

  /** Format profile for "Mi cho anh xem profile" */
  static formatForDisplay() {
    const p = this.get();
    if (!p) return 'Chưa có profile. Anh muốn Mi lưu thông tin của anh không?';
    return [
      `👤 **${p.preferred_name}** — ${p.full_role}`,
      `📍 ${p.city}, ${p.state}, ${p.country}`,
      `🕐 Timezone: ${p.timezone}`,
      `🏢 Businesses: ${p.businesses?.join(', ')}`,
      `📱 Works from: ${p.works_from?.join(', ')}`,
      `💬 Style: ${p.communication_style}`,
      `⚡ Delegation: ${p.delegation_style}`,
    ].filter(Boolean).join('\n');
  }
}
