import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

export function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function formatDateTime(value: string | null | undefined): string {
  const d = safeDate(value);
  return d ? format(d, 'MMM d, HH:mm') : '—';
}

export function formatDate(value: string | null | undefined): string {
  const d = safeDate(value);
  return d ? format(d, 'MMM d, yyyy') : '—';
}

export function formatTime(value: string | null | undefined): string {
  const d = safeDate(value);
  return d ? format(d, 'HH:mm') : '—';
}

export function formatRelative(value: string | null | undefined): string {
  const d = safeDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}

/** Mask everything but the domain-relevant part of an email — used wherever a full
 *  address isn't needed (§23: "mask full email addresses where not needed"). */
export function maskEmail(address: string | null | undefined): string {
  if (!address) return '—';
  const match = address.match(/^([^<]*<)?([^@>]+)@([^>]+)>?$/);
  if (!match) return address.length > 40 ? address.slice(0, 40) + '…' : address;
  const [, prefix, local, domain] = match;
  const maskedLocal = local.length <= 2 ? local[0] + '•' : local.slice(0, 2) + '•••';
  return `${prefix ?? ''}${maskedLocal}@${domain}`;
}

export function shortChecksum(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

export function truncate(value: string, max = 160): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}
