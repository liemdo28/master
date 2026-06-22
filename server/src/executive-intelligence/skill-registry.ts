/**
 * Governed Skill Registry — Phase 21 (Week 4)
 *
 * Loads SKILL.md files with YAML frontmatter + skill.manifest.json.
 * Validates: hash, approval, policy. Only approved skills are executable.
 * Pattern from OpenClaw: markdown instruction files with governance.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SkillManifest, SkillPolicy } from './types';

// ── Configuration ─────────────────────────────────────────────────────────────

const SKILLS_DIR = path.resolve(__dirname, 'skills');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoadedSkill {
  manifest: SkillManifest;
  markdownContent: string;
  loadedAt: string;
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseYAMLFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { metadata: {}, body: content };

  const yamlStr = match[1];
  const body = match[2];

  // Simple YAML parser for frontmatter (handles nested objects and arrays)
  const metadata: Record<string, unknown> = {};
  let currentKey = '';
  let currentArray: string[] | null = null;
  let currentObject: Record<string, string[]> | null = null;

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Top-level key
    const topMatch = trimmed.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (topMatch) {
      if (currentArray && currentKey) {
        metadata[currentKey] = currentArray;
        currentArray = null;
      }
      if (currentObject && currentKey) {
        metadata[currentKey] = currentObject;
        currentObject = null;
      }

      currentKey = topMatch[1];
      const value = topMatch[2].trim();
      if (value === '') {
        // Could be array or object
        currentArray = [];
        currentObject = null;
      } else {
        // Simple value
        metadata[currentKey] = value === 'true' ? true : value === 'false' ? false : value;
        currentArray = null;
        currentObject = null;
      }
      continue;
    }

    // Array item
    const arrayMatch = trimmed.match(/^-\s+(.+)$/);
    if (arrayMatch && currentArray) {
      currentArray.push(arrayMatch[1]);
      continue;
    }

    // Nested object key (for requires.env, policy, etc.)
    const nestedMatch = trimmed.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (nestedMatch && currentKey) {
      if (currentArray) {
        // Convert array to object for nested keys
        currentObject = { items: currentArray };
        currentArray = null;
      }
      if (!currentObject) currentObject = {};
      const nestedValue = nestedMatch[2].trim();
      if (nestedValue === '') {
        currentObject[nestedMatch[1]] = [];
      } else {
        currentObject[nestedMatch[1]] = [nestedValue];
      }
      continue;
    }
  }

  // Flush remaining
  if (currentArray && currentKey) metadata[currentKey] = currentArray;
  if (currentObject && currentKey) metadata[currentKey] = currentObject;

  return { metadata, body };
}

// ── Registry State ────────────────────────────────────────────────────────────

const loadedSkills = new Map<string, LoadedSkill>();

// ── Public API ────────────────────────────────────────────────────────────────

export const skillRegistry = {
  /**
   * Scan the skills directory and load all valid skills.
   */
  loadAll(): LoadedSkill[] {
    loadedSkills.clear();

    if (!fs.existsSync(SKILLS_DIR)) return [];

    const subdirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const dir of subdirs) {
      try {
        const skill = this.loadSkill(dir.name);
        if (skill) loadedSkills.set(dir.name, skill);
      } catch (err) {
        console.warn(`[SkillRegistry] Failed to load skill "${dir.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return Array.from(loadedSkills.values());
  },

  /**
   * Load a single skill by name.
   */
  loadSkill(name: string): LoadedSkill | null {
    const skillDir = path.join(SKILLS_DIR, name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const manifestPath = path.join(skillDir, 'skill.manifest.json');

    if (!fs.existsSync(skillMdPath)) return null;
    if (!fs.existsSync(manifestPath)) return null;

    const markdownContent = fs.readFileSync(skillMdPath, 'utf-8');
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as SkillManifest;

    // Compute hash of SKILL.md content
    const computedHash = computeFileHash(markdownContent);

    const skill: LoadedSkill = {
      manifest: {
        ...manifestJson,
        sha256: computedHash,  // Override with actual computed hash
      },
      markdownContent,
      loadedAt: new Date().toISOString(),
    };

    return skill;
  },

  /**
   * List all approved skills.
   */
  listApproved(): LoadedSkill[] {
    if (loadedSkills.size === 0) this.loadAll();
    return Array.from(loadedSkills.values())
      .filter(s => s.manifest.approved);
  },

  /**
   * Get a specific approved skill.
   */
  getApprovedSkill(name: string): LoadedSkill | null {
    const skill = loadedSkills.get(name);
    if (!skill || !skill.manifest.approved) return null;
    return skill;
  },

  /**
   * Validate a skill manifest + SKILL.md.
   */
  validateSkill(name: string): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const skillDir = path.join(SKILLS_DIR, name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const manifestPath = path.join(skillDir, 'skill.manifest.json');

    // Check SKILL.md exists
    if (!fs.existsSync(skillMdPath)) {
      errors.push(`SKILL.md not found at ${skillMdPath}`);
      return { valid: false, errors, warnings };
    }

    // Check manifest exists
    if (!fs.existsSync(manifestPath)) {
      errors.push(`skill.manifest.json not found at ${manifestPath}`);
      return { valid: false, errors, warnings };
    }

    // Parse manifest
    let manifest: SkillManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
      errors.push(`Invalid JSON in skill.manifest.json: ${e instanceof Error ? e.message : String(e)}`);
      return { valid: false, errors, warnings };
    }

    // Validate manifest fields
    if (!manifest.name) errors.push('manifest.name is required');
    if (!manifest.version) errors.push('manifest.version is required');
    if (!manifest.entry) errors.push('manifest.entry is required');
    if (typeof manifest.approved !== 'boolean') errors.push('manifest.approved must be boolean');
    if (!manifest.scope || !Array.isArray(manifest.scope)) errors.push('manifest.scope must be an array');

    // Check hash match
    const markdownContent = fs.readFileSync(skillMdPath, 'utf-8');
    const computedHash = computeFileHash(markdownContent);
    if (manifest.sha256 && manifest.sha256 !== 'REPLACE_ME' && manifest.sha256 !== computedHash) {
      errors.push(`Hash mismatch: manifest.sha256=${manifest.sha256}, computed=${computedHash}`);
    }

    // Check approval
    if (!manifest.approved) {
      warnings.push('Skill is not approved — it will not be loaded by the registry');
    }

    // Validate policy
    if (manifest.policy) {
      if (!manifest.policy.mode) errors.push('policy.mode is required');
      if (!manifest.policy.allowedConnectors) warnings.push('policy.allowedConnectors not set');
    } else {
      warnings.push('No policy defined — skill has no access restrictions');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Get a skill's markdown content for injection into LLM prompts.
   */
  getSkillPrompt(name: string): string | null {
    const skill = this.getApprovedSkill(name);
    if (!skill) return null;

    return [
      `## Skill: ${skill.manifest.name} v${skill.manifest.version}`,
      '',
      `Scope: ${skill.manifest.scope.join(', ')}`,
      `Policy: ${skill.manifest.policy.mode}`,
      '',
      skill.markdownContent,
    ].join('\n');
  },

  /**
   * Get summary of all loaded skills.
   */
  getSummary(): string {
    const all = Array.from(loadedSkills.values());
    const approved = all.filter(s => s.manifest.approved);

    const lines = [
      `🔧 *Skill Registry*`,
      `Total loaded: ${all.length}`,
      `Approved: ${approved.length}`,
      '',
    ];

    for (const s of approved) {
      lines.push(`• ${s.manifest.name} v${s.manifest.version} (${s.manifest.policy.mode}) — ${s.manifest.scope.join(', ')}`);
    }

    return lines.join('\n');
  },
};
