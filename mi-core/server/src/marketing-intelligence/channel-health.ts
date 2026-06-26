import { getBrandProfiles } from '../marketing-foundation/brand-intelligence';
import type { ChannelHealth } from './types';

export function buildChannelHealth(): Record<string, ChannelHealth[]> {
  const brands = getBrandProfiles();
  return Object.fromEntries(brands.map((brand) => [
    brand.brand_id,
    Object.entries(brand.connectorStatus).map(([channel, status]) => ({
      channel,
      status,
      usableForPlanning: status === 'ready' || status === 'configured',
      usableForPublishing: status === 'ready' || status === 'configured',
    })),
  ]));
}
