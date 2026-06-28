/**
 * oss-capability-fingerprint.ts
 * Fingerprints OSS capability selections to prevent duplicate OSS selection.
 */
import { createHash } from 'crypto';

export interface OssCapabilityFingerprintInput {
  capability: string; // e.g., "browser-automation", "data-analytics"
  business_domain: string;
  owner_department: string;
  primary_oss?: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

export function buildOssCapabilityFingerprint(input: OssCapabilityFingerprintInput): string {
  const parts = [
    normalize(input.capability),
    normalize(input.business_domain),
    normalize(input.owner_department),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function buildOssCapabilityFingerprintKey(input: OssCapabilityFingerprintInput): string {
  return buildOssCapabilityFingerprint(input);
}

const selectedCapabilities = new Map<string, string>(); // fingerprint -> selected OSS

export function checkOssSelection(input: OssCapabilityFingerprintInput, proposedOss: string): { allowed: boolean; existing: string | null } {
  const key = buildOssCapabilityFingerprintKey(input);
  const existing = selectedCapabilities.get(key);
  if (existing && existing !== proposedOss) {
    return { allowed: false, existing };
  }
  selectedCapabilities.set(key, proposedOss);
  return { allowed: true, existing: null };
}
