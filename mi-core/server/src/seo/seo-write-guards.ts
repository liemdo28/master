export type SeoWriteFlagName =
  | 'SEO_AUTOMATION_ENABLED'
  | 'SEO_PRODUCTION_PUBLISH_ENABLED'
  | 'SEO_GBP_WRITE_ENABLED'
  | 'SEO_WEBSITE_WRITE_ENABLED'
  | 'SEO_BACKLINK_WRITE_ENABLED';

export interface SeoWriteFlagState {
  name: SeoWriteFlagName;
  enabled: boolean;
  raw: string | null;
}

const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes', 'enabled']);
const FLAG_NAMES: SeoWriteFlagName[] = [
  'SEO_AUTOMATION_ENABLED',
  'SEO_PRODUCTION_PUBLISH_ENABLED',
  'SEO_GBP_WRITE_ENABLED',
  'SEO_WEBSITE_WRITE_ENABLED',
  'SEO_BACKLINK_WRITE_ENABLED',
];

export function envFlagEnabled(value: string | undefined | null): boolean {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return TRUE_VALUES.has(normalized);
}

export function getSeoWriteFlag(name: SeoWriteFlagName, env: NodeJS.ProcessEnv = process.env): SeoWriteFlagState {
  const raw = env[name] ?? null;
  return { name, enabled: envFlagEnabled(raw), raw };
}

export function getSeoWriteFlags(env: NodeJS.ProcessEnv = process.env): Record<SeoWriteFlagName, SeoWriteFlagState> {
  return FLAG_NAMES.reduce((acc, name) => {
    acc[name] = getSeoWriteFlag(name, env);
    return acc;
  }, {} as Record<SeoWriteFlagName, SeoWriteFlagState>);
}

export function isSeoAutomationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getSeoWriteFlag('SEO_AUTOMATION_ENABLED', env).enabled;
}

export function isSeoProductionPublishEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getSeoWriteFlag('SEO_PRODUCTION_PUBLISH_ENABLED', env).enabled;
}

export function isSeoGbpWriteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getSeoWriteFlag('SEO_GBP_WRITE_ENABLED', env).enabled;
}

export function isSeoWebsiteWriteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getSeoWriteFlag('SEO_WEBSITE_WRITE_ENABLED', env).enabled;
}

export function isSeoBacklinkWriteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getSeoWriteFlag('SEO_BACKLINK_WRITE_ENABLED', env).enabled;
}

export function disabledReason(flag: SeoWriteFlagName): string {
  return `${flag}=true is required for this live-write operation; default is disabled`;
}
