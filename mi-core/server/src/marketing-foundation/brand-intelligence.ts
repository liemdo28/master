import fs from 'fs';
import path from 'path';
import type { BrandProfile, MarketingSourceStatus } from './types';

const BRANDS_PATH = path.join(process.cwd(), 'SEO', 'shared', 'config', 'brands.json');

function normalizeConnectorStatus(value: any): MarketingSourceStatus {
  const status = String(value?.status || 'needs_config');
  if (status === 'ready' || status === 'configured') return status as MarketingSourceStatus;
  if (status === 'missing_credentials') return 'missing_credentials';
  if (status === 'not_applicable') return 'inactive';
  return 'needs_config';
}

export function getBrandProfiles(): BrandProfile[] {
  const raw = JSON.parse(fs.readFileSync(BRANDS_PATH, 'utf-8'));
  return (raw.brands || []).map((brand: any) => {
    const connectorStatus = Object.fromEntries(
      Object.entries(brand.connectors || {}).map(([name, config]) => [name, normalizeConnectorStatus(config)])
    ) as Record<string, MarketingSourceStatus>;
    const missingConnectors = Object.entries(connectorStatus)
      .filter(([, status]) => status === 'missing_credentials' || status === 'needs_config')
      .map(([name]) => name);
    return {
      brand_id: brand.brand_id,
      name: brand.name,
      domain: brand.domain,
      status: brand.status,
      industry: brand.industry,
      cuisine: brand.cuisine,
      connectorStatus,
      missingConnectors,
    };
  });
}

export function getActiveBrandProfiles(): BrandProfile[] {
  return getBrandProfiles().filter((brand) => brand.status === 'active');
}
