/**
 * objective-fingerprint.ts
 * Fingerprints objectives to detect duplicates.
 */
import { createHash } from 'crypto';

export interface ObjectiveFingerprintInput {
  objective_text: string;
  brand_id?: string;
  location_id?: string;
  target_metric?: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

export function buildObjectiveFingerprint(input: ObjectiveFingerprintInput): string {
  const parts = [
    normalize(input.objective_text),
    input.brand_id ? normalize(input.brand_id) : '',
    input.location_id ? normalize(input.location_id) : '',
    input.target_metric ? normalize(input.target_metric) : '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function buildObjectiveFingerprintKey(input: ObjectiveFingerprintInput): string {
  const parts = [
    normalize(input.objective_text),
    input.brand_id ? normalize(input.brand_id) : '',
    input.location_id ? normalize(input.location_id) : '',
  ];
  return parts.join('|');
}
