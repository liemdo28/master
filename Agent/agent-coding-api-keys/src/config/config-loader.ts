import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import type { GatewayConfig, ProviderConfig, ProviderKey, RouterMode } from '../types.js';
import { DEFAULT_MODEL_ALIASES, DEFAULT_ROUTES, defaultProviders } from './defaults.js';

dotenv.config();

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

function normalizeKey(raw: unknown, index: number): ProviderKey | null {
  if (!raw) return null;
  if (typeof raw === 'string') return { id: `key-${index + 1}`, value: raw, active: index === 0 };
  if (typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const value = String(obj.value || obj.key || '').trim();
  if (!value) return null;
  return {
    id: String(obj.id || `key-${index + 1}`),
    value,
    active: obj.active === true || index === 0,
    label: typeof obj.label === 'string' ? obj.label : undefined,
    disabledUntil: typeof obj.disabledUntil === 'number' ? obj.disabledUntil : undefined,
    lastError: typeof obj.lastError === 'string' ? obj.lastError : undefined
  };
}

function readLegacyConfig(configPath: string): Record<string, unknown> {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function envKeys(providerId: string): ProviderKey[] {
  const raw = process.env[`${providerId.toUpperCase()}_API_KEYS`] || process.env[`${providerId.toUpperCase()}_API_KEY`];
  return splitList(raw).map((value, index) => ({ id: `env-${index + 1}`, value, active: index === 0 }));
}

function mergeProvider(base: ProviderConfig, rawProvider: Record<string, unknown> | undefined, activeIds: string[]): ProviderConfig {
  const envPrefix = base.id.toUpperCase();
  const rawKeys = Array.isArray(rawProvider?.keys) ? rawProvider.keys : [];
  const keys = [...rawKeys.map(normalizeKey).filter((key): key is ProviderKey => Boolean(key)), ...envKeys(base.id)];
  const firstActive = keys.findIndex(k => k.active);
  const normalizedKeys = keys.map((key, index) => ({ ...key, active: firstActive >= 0 ? index === firstActive : index === 0 }));
  const configuredModels = splitList(rawProvider?.models);

  return {
    ...base,
    baseURL: String(process.env[`${envPrefix}_BASE_URL`] || rawProvider?.baseURL || base.baseURL).replace(/\/$/, ''),
    defaultModel: String(process.env[`${envPrefix}_DEFAULT_MODEL`] || rawProvider?.model || rawProvider?.defaultModel || base.defaultModel),
    models: configuredModels.length ? configuredModels : base.models,
    aliases: { ...base.aliases, ...(typeof rawProvider?.aliases === 'object' ? rawProvider.aliases as Record<string, string[]> : {}) },
    keys: normalizedKeys,
    enabled: activeIds.includes(base.id) || normalizedKeys.length > 0 && rawProvider?.enabled !== false && base.id !== 'ollama',
    timeoutMs: intEnv(`${envPrefix}_TIMEOUT_MS`, base.timeoutMs)
  };
}

export function loadGatewayConfig(): GatewayConfig {
  const requestTimeoutMs = intEnv('REQUEST_TIMEOUT_MS', 120000);
  const configPath = path.resolve(process.cwd(), process.env.CONFIG_PATH || './keys.json');
  const raw = readLegacyConfig(configPath);
  const rawProviders = (raw.providers && typeof raw.providers === 'object' ? raw.providers : {}) as Record<string, Record<string, unknown>>;
  const activeIds = splitList(process.env.ACTIVE_PROVIDERS).length
    ? splitList(process.env.ACTIVE_PROVIDERS)
    : splitList(raw.activeProviders);

  const providers = defaultProviders(requestTimeoutMs).map(provider => mergeProvider(provider, rawProviders[provider.id], activeIds));
  const mode = String(process.env.ROUTER_MODE || raw.mode || 'fallback') as RouterMode;

  return {
    host: process.env.HOST || '127.0.0.1',
    port: intEnv('PORT', 3456),
    mode,
    requestTimeoutMs,
    healthIntervalMs: intEnv('HEALTH_INTERVAL_MS', 60000),
    providers: providers
      .map(provider => ({ ...provider, enabled: activeIds.length ? activeIds.includes(provider.id) : provider.enabled }))
      .sort((a, b) => {
        const ai = activeIds.indexOf(a.id);
        const bi = activeIds.indexOf(b.id);
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        return a.priority - b.priority;
      }),
    modelAliases: { ...DEFAULT_MODEL_ALIASES, ...(typeof raw.modelAliases === 'object' ? raw.modelAliases as Record<string, string[]> : {}) },
    routes: { ...DEFAULT_ROUTES, ...(typeof raw.routes === 'object' ? raw.routes as Record<string, string[]> : {}) }
  };
}

export function publicProvider(provider: ProviderConfig): Omit<ProviderConfig, 'keys'> & { keys: Array<Omit<ProviderKey, 'value'> & { masked: string }> } {
  return {
    ...provider,
    keys: provider.keys.map(key => ({
      id: key.id,
      active: key.active,
      label: key.label,
      disabledUntil: key.disabledUntil,
      lastError: key.lastError,
      masked: maskSecret(key.value)
    }))
  };
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
