/**
 * PeopleMemory.mjs
 * Knows CEO's team, contacts, and resolves name → profile.
 * People data persists to .local-agent-global/memory/people.json
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR  = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const PEOPLE_PATH = path.join(GLOBAL_DIR, 'memory', 'people.json');

// Built-in known people (from owner_profile.json key_staff + known contacts)
const BUILT_IN_PEOPLE = [
  {
    id: 'maria',
    name: 'Maria',
    aliases: ['maria'],
    role: 'Manager / Dashboard admin',
    relationship: 'staff',
    stores: ['raw-sushi', 'bakudan'],
    platforms: { asana: null, dashboard: 'maria', email: null },
    notes: 'Manages both restaurants via Dashboard',
  },
  {
    id: 'hoang',
    name: 'Hoang',
    aliases: ['hoang'],
    role: 'Operations',
    relationship: 'staff',
    stores: ['raw-sushi'],
    platforms: { asana: null, dashboard: 'hoang', email: null },
    notes: 'Operations staff',
  },
  {
    id: 'nguyen',
    name: 'Nguyên',
    aliases: ['nguyen', 'nguyên', 'nguyen'],
    role: 'Staff',
    relationship: 'staff',
    stores: ['raw-sushi', 'bakudan'],
    platforms: { asana: null, dashboard: 'nguyen', email: null },
    notes: 'Staff member',
  },
  {
    id: 'ceo',
    name: 'anh',
    aliases: ['anh', 'sen', 'ceo', 'owner', 'i', 'me', 'tôi'],
    role: 'CEO & Founder',
    relationship: 'owner',
    stores: ['raw-sushi', 'bakudan'],
    platforms: {},
    notes: 'Owner of both restaurants',
  },
];

function loadPeople() {
  const builtin = [...BUILT_IN_PEOPLE];
  try {
    const stored = JSON.parse(fs.readFileSync(PEOPLE_PATH, 'utf-8'));
    // Merge: stored overrides built-in by id
    const storedMap = new Map(stored.map(p => [p.id, p]));
    return builtin.map(p => storedMap.has(p.id) ? { ...p, ...storedMap.get(p.id) } : p)
      .concat(stored.filter(p => !builtin.find(b => b.id === p.id)));
  } catch {
    return builtin;
  }
}

function savePeople(people) {
  fs.mkdirSync(path.dirname(PEOPLE_PATH), { recursive: true });
  fs.writeFileSync(PEOPLE_PATH, JSON.stringify(people, null, 2));
}

export class PeopleMemory {
  /** Resolve a name mention to a person profile */
  static resolve(text) {
    if (!text) return null;
    const t = text.toLowerCase().trim();
    const people = loadPeople();
    return people.find(p => p.aliases.some(a => t.includes(a))) || null;
  }

  /** Get person by ID */
  static get(id) {
    return loadPeople().find(p => p.id === id) || null;
  }

  /** Get all people */
  static getAll() {
    return loadPeople();
  }

  /** Update a person's info (e.g. add email) */
  static update(id, updates) {
    const people = loadPeople();
    const idx = people.findIndex(p => p.id === id);
    if (idx === -1) {
      people.push({ id, ...updates, updated_at: new Date().toISOString() });
    } else {
      people[idx] = { ...people[idx], ...updates, updated_at: new Date().toISOString() };
    }
    savePeople(people);
  }

  /** Add a new person */
  static add(person) {
    const people = loadPeople();
    if (people.find(p => p.id === person.id)) return false;
    people.push({ ...person, created_at: new Date().toISOString() });
    savePeople(people);
    return true;
  }

  /** Get people by store */
  static getByStore(storeId) {
    return loadPeople().filter(p => p.stores?.includes(storeId));
  }

  /** Format profile for Mi response */
  static formatProfile(person) {
    if (!person) return null;
    return [
      `👤 **${person.name}**`,
      `Role: ${person.role}`,
      `Relationship: ${person.relationship}`,
      person.stores?.length ? `Stores: ${person.stores.join(', ')}` : '',
      person.platforms?.email ? `Email: ${person.platforms.email}` : '',
      person.notes ? `Notes: ${person.notes}` : '',
    ].filter(Boolean).join('\n');
  }
}
