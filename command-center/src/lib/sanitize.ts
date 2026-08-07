import DOMPurify from 'dompurify';

/** The only place `dangerouslySetInnerHTML` may be fed from — everything else must
 *  render Gmail/document/knowledge content as plain text via JSX text nodes, which
 *  React already escapes. Used only where a bounded, sanitized snippet of rich text
 *  is genuinely needed (currently: nowhere by default — kept for future document
 *  preview use, config strips all tags down to plain text today). */
export function sanitizeHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

const DANGEROUS_PROTOCOLS = /^\s*(javascript|data|vbscript):/i;

/** Any link surfaced from external content (Gmail, documents) must pass through
 *  this before being used as an href — rejects javascript:/data:/vbscript: targets. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (DANGEROUS_PROTOCOLS.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
