import fs from 'fs';
import path from 'path';
import type { ContentAsset } from './types';

const DRAFTS_DIR = path.join(process.cwd(), '.local-agent-global', 'seo-drafts');

function parseField(content: string, label: string): string | null {
  const re = new RegExp(`### ${label}\\s*\\n([^\\n]+)`, 'i');
  return content.match(re)?.[1]?.trim() || null;
}

export function listContentAssets(limit = 25): ContentAsset[] {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs.readdirSync(DRAFTS_DIR)
    .filter((file) => file.endsWith('.md'))
    .slice(0, limit)
    .map((file) => {
      const full = path.join(DRAFTS_DIR, file);
      const content = fs.readFileSync(full, 'utf-8');
      const brand = content.match(/^# SEO PREVIEW — (.+)$/m)?.[1]?.trim() || 'Unknown';
      const topic = parseField(content, 'Topic') || 'Untitled topic';
      const keywords = (parseField(content, 'SEO Keywords') || '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const generatedAt = content.match(/^## Generated: (.+)$/m)?.[1]?.trim() || null;
      return {
        asset_id: file.replace(/\.md$/, ''),
        brand,
        topic,
        keywords,
        path: full,
        generatedAt,
        publishReady: false,
      };
    });
}
