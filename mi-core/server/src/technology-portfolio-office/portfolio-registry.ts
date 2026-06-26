import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { PortfolioEvidence, PortfolioItem } from './types';
import { getSeedPortfolioItems } from './seed-portfolio';

const ITEMS_DIR = join(process.cwd(), '.mi-harness', 'technology-portfolio', 'items');

function ensureDirs() {
  mkdirSync(ITEMS_DIR, { recursive: true });
}

function itemPath(id: string) {
  return join(ITEMS_DIR, `${id}.json`);
}

export function seedPortfolioRegistry(): PortfolioItem[] {
  ensureDirs();
  const existing = getPortfolioItems();
  if (existing.length) return existing;
  const items = getSeedPortfolioItems();
  items.forEach(savePortfolioItem);
  return items;
}

export function savePortfolioItem(item: PortfolioItem): PortfolioItem {
  ensureDirs();
  item.updatedAt = new Date().toISOString();
  writeFileSync(itemPath(item.item_id), JSON.stringify(item, null, 2));
  return item;
}

export function getPortfolioItem(id: string): PortfolioItem | null {
  const fp = itemPath(id);
  if (!existsSync(fp)) return null;
  try {
    return JSON.parse(readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

export function getPortfolioItems(): PortfolioItem[] {
  ensureDirs();
  return readdirSync(ITEMS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(ITEMS_DIR, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function addPortfolioEvidence(id: string, evidence: Omit<PortfolioEvidence, 'capturedAt'>): PortfolioItem | null {
  const item = getPortfolioItem(id);
  if (!item) return null;
  item.evidence.push({ ...evidence, capturedAt: new Date().toISOString() });
  return savePortfolioItem(item);
}

export const TECHNOLOGY_PORTFOLIO_REGISTRY_STATUS = 'TECHNOLOGY_PORTFOLIO_REGISTRY_OPERATIONAL';
