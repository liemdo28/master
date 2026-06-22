/**
 * ContactResolver.mjs
 * Resolves "David", "Maria", "Nguyên" to full contact info.
 * Resolution order:
 * 1. PeopleMemory (team/staff)
 * 2. contacts.json (saved contacts)
 * 3. Gmail history cache (seen emails)
 * 4. Ask CEO if ambiguous
 */

import fs from 'fs';
import path from 'path';
import { PeopleMemory } from './PeopleMemory.mjs';

const GLOBAL_DIR     = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CONTACTS_PATH  = path.join(GLOBAL_DIR, 'memory', 'contacts.json');
const GMAIL_CACHE    = path.join(GLOBAL_DIR, 'visibility', 'gmail', 'inbox_cache.json');

function loadContacts() {
  try { return JSON.parse(fs.readFileSync(CONTACTS_PATH, 'utf-8')); }
  catch { return []; }
}

function saveContacts(contacts) {
  fs.mkdirSync(path.dirname(CONTACTS_PATH), { recursive: true });
  fs.writeFileSync(CONTACTS_PATH, JSON.stringify(contacts, null, 2));
}

function searchGmailHistory(name) {
  try {
    const cache = JSON.parse(fs.readFileSync(GMAIL_CACHE, 'utf-8'));
    const n = name.toLowerCase();
    const matches = new Map();
    for (const email of (cache.emails || [])) {
      const from = email.from || '';
      if (from.toLowerCase().includes(n)) {
        const emailMatch = from.match(/<([^>]+)>/) || from.match(/([\w.-]+@[\w.-]+\.\w+)/);
        const nameMatch  = from.match(/^([^<]+)</);
        if (emailMatch) {
          const emailAddr = emailMatch[1];
          if (!matches.has(emailAddr)) {
            matches.set(emailAddr, {
              email: emailAddr,
              name: nameMatch ? nameMatch[1].trim() : name,
              source: 'gmail-history',
              last_seen: email.date,
              count: 1,
            });
          } else {
            matches.get(emailAddr).count++;
          }
        }
      }
    }
    return Array.from(matches.values()).sort((a, b) => b.count - a.count);
  } catch { return []; }
}

export class ContactResolver {
  /**
   * Resolve a name to a contact with email.
   * Returns: { email, name, source, ambiguous, candidates }
   */
  static resolve(nameOrEmail) {
    if (!nameOrEmail) return null;

    // Already an email?
    if (/@/.test(nameOrEmail)) {
      return { email: nameOrEmail, name: '', source: 'direct-email', resolved: true };
    }

    const query = nameOrEmail.toLowerCase().trim();

    // 1. Check PeopleMemory (team/staff)
    const person = PeopleMemory.resolve(query);
    if (person) {
      if (person.platforms?.email) {
        return { email: person.platforms.email, name: person.name, role: person.role, source: 'people-memory', resolved: true };
      }
      // Known person but no email yet
      return {
        email: null,
        name: person.name,
        role: person.role,
        source: 'people-memory',
        resolved: false,
        needs_email: true,
        message: `Em biết ${person.name} (${person.role}) nhưng chưa có email. Anh cung cấp email cho ${person.name} không?`,
      };
    }

    // 2. Check saved contacts
    const contacts = loadContacts();
    const contactMatches = contacts.filter(c =>
      c.name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      (c.aliases || []).some(a => a.toLowerCase().includes(query))
    );
    if (contactMatches.length === 1) {
      return { ...contactMatches[0], source: 'contacts-db', resolved: true };
    }
    if (contactMatches.length > 1) {
      return {
        email: null,
        name: nameOrEmail,
        source: 'contacts-db',
        resolved: false,
        ambiguous: true,
        candidates: contactMatches,
        message: `Em tìm thấy ${contactMatches.length} người tên "${nameOrEmail}". Anh muốn gửi cho ai?\n` +
          contactMatches.map((c, i) => `${i+1}. ${c.name} — ${c.email}`).join('\n'),
      };
    }

    // 3. Check Gmail history
    const gmailMatches = searchGmailHistory(nameOrEmail);
    if (gmailMatches.length === 1) {
      return { ...gmailMatches[0], resolved: true };
    }
    if (gmailMatches.length > 1) {
      return {
        email: null,
        name: nameOrEmail,
        source: 'gmail-history',
        resolved: false,
        ambiguous: true,
        candidates: gmailMatches,
        message: `Em tìm thấy ${gmailMatches.length} người tên "${nameOrEmail}" trong Gmail. Anh chọn ai?\n` +
          gmailMatches.slice(0, 5).map((c, i) => `${i+1}. ${c.name} — ${c.email} (${c.count} emails)`).join('\n'),
      };
    }

    // 4. Not found
    return {
      email: null,
      name: nameOrEmail,
      source: 'not-found',
      resolved: false,
      message: `Em không tìm thấy "${nameOrEmail}" trong danh bạ. Anh cho em biết email của ${nameOrEmail} để tiếp tục.`,
    };
  }

  /** Save a contact to persistent store */
  static save(contact) {
    const contacts = loadContacts();
    const existing = contacts.findIndex(c => c.email === contact.email);
    if (existing >= 0) {
      contacts[existing] = { ...contacts[existing], ...contact, updated_at: new Date().toISOString() };
    } else {
      contacts.push({ ...contact, id: `contact_${Date.now().toString(36)}`, created_at: new Date().toISOString() });
    }
    saveContacts(contacts);
    return true;
  }

  /** List all known contacts */
  static list() {
    return [...loadContacts(), ...PeopleMemory.getAll().filter(p => p.platforms?.email)];
  }
}
