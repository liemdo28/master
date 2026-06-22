/**
 * ProjectMemory.mjs
 * Knows all active projects and their status.
 * Reads from project registry + scan results.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR      = process.env.GLOBAL_DIR  || 'E:/Project/Master/.local-agent-global';
const MASTER_ROOT     = process.env.MASTER_ROOT || 'E:/Project/Master';
const REGISTRY_PATH   = path.join(GLOBAL_DIR, 'mi-core', 'master-projects.json');
const PROJECTS_CACHE  = path.join(GLOBAL_DIR, 'visibility', 'projects', 'projects.json');

// Known project aliases
const PROJECT_ALIASES = {
  'rawwebsite':         ['raw website', 'rawwebsite', 'raw sushi website', 'rawsushibar.com'],
  'bakudan-website':    ['bakudan website', 'bakudan site', 'bakudanramen.com'],
  'dashboard':          ['dashboard', 'bakudan dashboard', 'dashboard.bakudanramen.com'],
  'mi-core':            ['mi', 'mi-core', 'mi core', 'mi server'],
  'integration-system': ['integration', 'integration system'],
  'whatsapp-api':       ['whatsapp', 'whatsapp api'],
};

export class ProjectMemory {
  static getAll() {
    for (const p of [REGISTRY_PATH, PROJECTS_CACHE]) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        const list = Array.isArray(data) ? data : (data.projects || []);
        if (list.length > 0) return list;
      } catch { /* try next */ }
    }
    return [];
  }

  static resolve(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    for (const [id, aliases] of Object.entries(PROJECT_ALIASES)) {
      if (aliases.some(a => t.includes(a))) {
        const projects = this.getAll();
        return projects.find(p => p.name?.toLowerCase().includes(id) || p.project_id === id) || { name: id, id };
      }
    }
    // Direct name match
    const projects = this.getAll();
    return projects.find(p => p.name?.toLowerCase().includes(t)) || null;
  }

  static getWithIssues() {
    return this.getAll().filter(p => p.issues?.length > 0 || p.git_dirty || p.has_errors);
  }

  static searchProjects(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.type?.toLowerCase().includes(q) ||
      p.framework?.toLowerCase().includes(q)
    );
  }
}
