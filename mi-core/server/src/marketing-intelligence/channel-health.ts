import { getBrandProfiles } from '../marketing-foundation/brand-intelligence';
import type { ChannelHealth } from './types';

export function buildChannelHealth(): Record<string, ChannelHealth[]> {
  const brands = getBrandProfiles();
  return Object.fromEntries(brands.map((brand) => [
    brand.brand_id,
    Object.entries(brand.connectorStatus).map(([channel, status]) => {
      const normalizedStatus = channel === 'gbp' && status === 'needs_config'
        ? 'missing_credentials'
        : status;
      return {
        channel,
        status: normalizedStatus,
        usableForPlanning: normalizedStatus === 'ready' || normalizedStatus === 'configured',
        usableForPublishing: normalizedStatus === 'ready' || normalizedStatus === 'configured',
      };
    }),
  ]));
}
