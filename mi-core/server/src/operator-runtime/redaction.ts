import { redactSecrets, redactObject } from '../bigdata/secret-redactor';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}\b/g;
const CREDIT_CARD_PATTERN = /(?<!\[REDACTED:phone\]\s)(?:\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b|\b(?:\d[ -]*?){13,19}\b)/g;
const COOKIE_PATTERN = /\bcookie\s*:\s*[^.;\n\r]+/gi;

export interface RedactionProof {
  original: string;
  redacted: string;
  redactions: string[];
}

export function redactSensitiveText(text: string): RedactionProof {
  let redacted = text;
  const redactions: string[] = [];

  const secretResult = redactSecrets(redacted);
  redacted = secretResult.redacted;
  redactions.push(...secretResult.found);

  const rules: Array<{ name: string; pattern: RegExp; replacement: string }> = [
    { name: 'email', pattern: EMAIL_PATTERN, replacement: '[REDACTED:email]' },
    { name: 'credit_card', pattern: CREDIT_CARD_PATTERN, replacement: '[REDACTED:credit_card]' },
    { name: 'phone', pattern: PHONE_PATTERN, replacement: '[REDACTED:phone]' },
    { name: 'cookie', pattern: COOKIE_PATTERN, replacement: '[REDACTED:cookie]' },
  ];

  for (const rule of rules) {
    const before = redacted;
    redacted = redacted.replace(rule.pattern, rule.replacement);
    if (before !== redacted) redactions.push(rule.name);
  }

  return { original: text, redacted, redactions: Array.from(new Set(redactions)) };
}

export function redactSensitiveObject<T>(input: T): { clean: T; redactions: string[] } {
  const objectResult = redactObject(input);
  const serialized = JSON.stringify(objectResult.clean);
  const textResult = redactSensitiveText(serialized);
  return {
    clean: JSON.parse(textResult.redacted) as T,
    redactions: Array.from(new Set([...objectResult.secrets, ...textResult.redactions])),
  };
}
