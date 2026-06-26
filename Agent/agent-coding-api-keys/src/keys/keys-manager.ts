import fs from 'node:fs';
import path from 'node:path';
import type { GatewayConfig } from '../types.js';

export interface KeyEntry {
  id?: string;
  value: string;
  active: boolean;
  note?: string;
  label?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProviderKeys {
  baseURL: string;
  model: string;
  models?: string[];
  aliases?: Record<string, string[]>;
  keys: KeyEntry[];
}

export interface KeysConfig {
  activeProviders: string[];
  mode: string;
  providers: Record<string, ProviderKeys>;
}

const configPath = path.resolve(process.cwd(), process.env.CONFIG_PATH || './keys.json');

let cachedConfig: KeysConfig | null = null;
let lastModified = 0;

export const keysManager = {
  /**
   * Load keys.json from disk (with caching)
   */
  loadConfig(): KeysConfig {
    try {
      const stat = fs.statSync(configPath);
      if (cachedConfig && stat.mtimeMs === lastModified) {
        return cachedConfig;
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as KeysConfig;
      cachedConfig = parsed;
      lastModified = stat.mtimeMs;
      return parsed;
    } catch (error) {
      console.error(`Failed to load keys.json from ${configPath}:`, error);
      throw error;
    }
  },

  /**
   * Save keys.json to disk
   */
  saveConfig(config: KeysConfig): void {
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      cachedConfig = config;
      lastModified = fs.statSync(configPath).mtimeMs;
    } catch (error) {
      console.error(`Failed to save keys.json to ${configPath}:`, error);
      throw error;
    }
  },

  /**
   * Get all keys for a provider
   */
  getProviderKeys(providerId: string): KeyEntry[] {
    const config = this.loadConfig();
    const provider = config.providers[providerId];
    return provider?.keys || [];
  },

  /**
   * Add a new key to a provider
   */
  addKey(providerId: string, keyValue: string, label?: string): KeyEntry {
    const config = this.loadConfig();
    if (!config.providers[providerId]) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const id = `key-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const entry: KeyEntry = {
      id,
      value: keyValue,
      active: true,
      label: label || `Key (${new Date().toISOString().slice(0, 10)})`,
      createdAt: Date.now(),
    };

    config.providers[providerId].keys.push(entry);
    this.saveConfig(config);
    return entry;
  },

  /**
   * Update a key's properties
   */
  updateKey(providerId: string, keyId: string, updates: Partial<KeyEntry>): KeyEntry | null {
    const config = this.loadConfig();
    const provider = config.providers[providerId];
    if (!provider) return null;

    const keyIndex = provider.keys.findIndex((k) => k.value === keyId || k.id === keyId);
    if (keyIndex === -1) return null;

    const original = provider.keys[keyIndex]!;
    const updated: KeyEntry = {
      ...original,
      ...updates,
      value: original.value,
      active: updates.active !== undefined ? updates.active : original.active,
      updatedAt: Date.now(),
    };

    provider.keys[keyIndex] = updated;
    this.saveConfig(config);
    return updated;
  },

  /**
   * Delete a key from a provider
   */
  deleteKey(providerId: string, keyId: string): boolean {
    const config = this.loadConfig();
    const provider = config.providers[providerId];
    if (!provider) return false;

    const initialLength = provider.keys.length;
    provider.keys = provider.keys.filter((k) => k.value !== keyId && k.id !== keyId);

    if (provider.keys.length < initialLength) {
      this.saveConfig(config);
      return true;
    }
    return false;
  },

  /**
   * Toggle key active status
   */
  toggleKey(providerId: string, keyId: string, active: boolean): KeyEntry | null {
    return this.updateKey(providerId, keyId, { active });
  },

  /**
   * Get summary of all providers and their key counts
   */
  getSummary(): Record<string, { count: number; active: number; models: string[] }> {
    const config = this.loadConfig();
    const summary: Record<string, { count: number; active: number; models: string[] }> = {};

    for (const [id, provider] of Object.entries(config.providers)) {
      summary[id] = {
        count: provider.keys.length,
        active: provider.keys.filter((k) => k.active).length,
        models: provider.models || [provider.model],
      };
    }

    return summary;
  },

  /**
   * Get all provider info with keys (masked for safety)
   */
  getAllProviders(): Record<string, { baseURL: string; models: string[]; keys: Array<Omit<KeyEntry, 'value'> & { masked: string }> }> {
    const config = this.loadConfig();
    const result: Record<string, any> = {};

    for (const [id, provider] of Object.entries(config.providers)) {
      result[id] = {
        baseURL: provider.baseURL,
        models: provider.models || [provider.model],
        keys: provider.keys.map((k) => ({
          id: k.id || `key-${provider.keys.indexOf(k)}`,
          active: k.active,
          label: k.label || 'Unnamed',
          masked: k.value.slice(0, 8) + '...' + k.value.slice(-4),
          createdAt: k.createdAt,
          updatedAt: k.updatedAt,
        })),
      };
    }

    return result;
  },

  /**
   * Invalidate cache (useful after external changes)
   */
  invalidateCache(): void {
    cachedConfig = null;
    lastModified = 0;
  },
};
