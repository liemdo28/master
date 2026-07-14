/**
 * SEO Control Center — prompt template loader (spec §26).
 * Templates live as Markdown files with {{placeholder}} tokens under
 * mi-core/prompts/seo/<template-name>.md
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// mi-core/server/src/seo/ai-providers -> mi-core/prompts/seo
const PROMPTS_DIR = process.env.MI_PROMPTS_DIR
  ? join(process.env.MI_PROMPTS_DIR, 'seo')
  : join(__dirname, '..', '..', '..', '..', 'prompts', 'seo');

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function templatePath(templateName: string): string {
  const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '');
  return join(PROMPTS_DIR, `${safeName}.md`);
}

/**
 * Load mi-core/prompts/seo/<templateName>.md and substitute {{placeholders}}
 * with values from `vars`. Throws if the template file doesn't exist or if
 * a placeholder present in the template has no corresponding entry in
 * `vars` (empty string is a valid value; missing key is not).
 */
export function renderPromptTemplate(templateName: string, vars: Record<string, string>): string {
  const filePath = templatePath(templateName);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${templateName} (looked at ${filePath})`);
  }

  const raw = readFileSync(filePath, 'utf8');
  const missing = new Set<string>();

  const rendered = raw.replace(PLACEHOLDER_RE, (_match, key: string) => {
    if (!(key in vars)) {
      missing.add(key);
      return `{{${key}}}`;
    }
    return vars[key];
  });

  if (missing.size > 0) {
    throw new Error(
      `Prompt template "${templateName}" is missing required placeholder value(s): ${Array.from(missing).join(', ')}`,
    );
  }

  return rendered;
}

/** List the placeholder names a template declares, without rendering it. */
export function getTemplatePlaceholders(templateName: string): string[] {
  const filePath = templatePath(templateName);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${templateName} (looked at ${filePath})`);
  }
  const raw = readFileSync(filePath, 'utf8');
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE);
  while ((m = re.exec(raw)) !== null) found.add(m[1]);
  return Array.from(found);
}
