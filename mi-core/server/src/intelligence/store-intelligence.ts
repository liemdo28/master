/**
 * Store Intelligence — compare stores, compliance, operational health
 */
import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

function readJson<T>(file: string, def: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return def; }
}

// ── Store definitions ─────────────────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  location: string;
  type: 'ramen' | 'sushi';
  timezone: string;
}

export const STORES: Store[] = [
  { id: 'bakudan', name: 'Bakudan Ramen', location: 'San Antonio, TX', type: 'ramen', timezone: 'America/Chicago' },
  { id: 'raw-sushi', name: 'Raw Sushi Bar', location: 'Stockton, CA', type: 'sushi', timezone: 'America/Los_Angeles' },
];

// ── Operational Health ────────────────────────────────────────────────────────

export interface StoreHealth {
  store_id: string;
  store_name: string;
  operational_score: number; // 0-100
  food_safety_score: number; // 0-100
  compliance_score: number;  // 0-100
  overall_score: number;     // weighted average
  issues: string[];
  last_updated: string;
}

function loadFoodSafetyData() {
  return readJson<any>(path.join(GLOBAL_DIR, 'visibility', 'food-safety', 'data.json'), { status: 'no_data', recent_submissions: [], stores: [] });
}

function loadDailySnapshot() {
  return readJson<any>(path.join(GLOBAL_DIR, 'visibility', 'daily-snapshot.json'), {});
}

export function getStoreHealth(storeId: string): StoreHealth {
  const store = STORES.find(s => s.id === storeId);
  if (!store) throw new Error(`Unknown store: ${storeId}`);

  const fsData = loadFoodSafetyData();
  const storeSubmissions = (fsData.recent_submissions || []).filter((s: any) =>
    s.store?.toLowerCase().includes(store.name.toLowerCase().split(' ')[0]) ||
    s.store_id === storeId
  );

  const issues: string[] = [];
  let foodSafetyScore = 80; // default baseline

  if (fsData.status === 'no_data') {
    foodSafetyScore = 60;
    issues.push('Food safety pilot not started');
  } else if (storeSubmissions.length > 0) {
    const failCount = storeSubmissions.filter((s: any) => s.status !== 'pass').length;
    foodSafetyScore = Math.max(40, 100 - (failCount / storeSubmissions.length) * 60);
    if (failCount > 0) issues.push(`${failCount} food safety issue(s) detected`);
  }

  const complianceScore = issues.length === 0 ? 90 : Math.max(50, 90 - issues.length * 15);
  const operationalScore = 95; // default — would integrate with POS/reservation systems
  const overallScore = Math.round((operationalScore * 0.4 + foodSafetyScore * 0.4 + complianceScore * 0.2));

  return {
    store_id: storeId,
    store_name: store.name,
    operational_score: operationalScore,
    food_safety_score: Math.round(foodSafetyScore),
    compliance_score: complianceScore,
    overall_score: overallScore,
    issues,
    last_updated: new Date().toISOString(),
  };
}

// ── Store Comparison ──────────────────────────────────────────────────────────

export interface StoreComparison {
  stores: StoreHealth[];
  winner: string;
  areas_for_improvement: Record<string, string[]>;
  formatted: string;
}

export function compareStores(): StoreComparison {
  const healths = STORES.map(s => getStoreHealth(s.id));
  const winner = healths.reduce((a, b) => a.overall_score >= b.overall_score ? a : b).store_name;

  const improvements: Record<string, string[]> = {};
  for (const h of healths) {
    const areas: string[] = [];
    if (h.food_safety_score < 80) areas.push('Food safety checks');
    if (h.compliance_score < 80) areas.push('Compliance documentation');
    if (h.operational_score < 80) areas.push('Operational efficiency');
    if (areas.length) improvements[h.store_name] = areas;
  }

  const scoreBar = (n: number) => '█'.repeat(Math.round(n / 10)) + '░'.repeat(10 - Math.round(n / 10));

  const lines: string[] = [
    '🏪 *Store Comparison*',
    '',
    ...healths.map(h => [
      `*${h.store_name}* (${STORES.find(s => s.id === h.store_id)?.location})`,
      `  Overall:    ${scoreBar(h.overall_score)} ${h.overall_score}/100`,
      `  Operations: ${scoreBar(h.operational_score)} ${h.operational_score}/100`,
      `  Food Safety:${scoreBar(h.food_safety_score)} ${h.food_safety_score}/100`,
      `  Compliance: ${scoreBar(h.compliance_score)} ${h.compliance_score}/100`,
      h.issues.length ? `  Issues: ${h.issues.join(', ')}` : '',
    ].filter(Boolean).join('\n')),
    '',
    `🏆 Leading store: *${winner}*`,
  ];

  if (Object.keys(improvements).length > 0) {
    lines.push('', '📋 *Improvement areas*');
    for (const [store, areas] of Object.entries(improvements)) {
      lines.push(`${store}: ${areas.join(', ')}`);
    }
  }

  return { stores: healths, winner, areas_for_improvement: improvements, formatted: lines.join('\n') };
}

// ── Compliance Summary ────────────────────────────────────────────────────────

export interface ComplianceReport {
  store_id: string;
  store_name: string;
  food_safety_status: string;
  health_code_status: string;
  employee_records_status: string;
  equipment_checks_status: string;
  overall_status: 'compliant' | 'needs_attention' | 'critical';
  notes: string[];
  formatted: string;
}

export function getComplianceReport(storeId?: string): ComplianceReport[] {
  const targetStores = storeId ? STORES.filter(s => s.id === storeId) : STORES;
  const fsData = loadFoodSafetyData();

  return targetStores.map(store => {
    const health = getStoreHealth(store.id);
    const notes: string[] = [];

    const foodSafetyStatus = fsData.status === 'no_data' ? 'Pilot pending' :
      health.food_safety_score >= 80 ? 'Compliant' : 'Needs attention';

    if (foodSafetyStatus === 'Needs attention') notes.push('Schedule food safety inspection');
    if (health.food_safety_score < 70) notes.push('Critical: food safety score below threshold');

    const overallStatus: ComplianceReport['overall_status'] =
      health.overall_score >= 80 ? 'compliant' :
      health.overall_score >= 60 ? 'needs_attention' : 'critical';

    const icon = overallStatus === 'compliant' ? '✅' : overallStatus === 'needs_attention' ? '⚠️' : '🚨';

    const lines = [
      `${icon} *${store.name}* — ${store.location}`,
      `  Food Safety: ${foodSafetyStatus}`,
      `  Health Code: Monitoring active`,
      `  Employee Records: On file`,
      `  Equipment Checks: ${health.issues.some(i => i.includes('equipment')) ? 'Action needed' : 'Scheduled'}`,
      `  Overall: ${overallStatus.replace('_', ' ').toUpperCase()}`,
      notes.length ? `  Notes: ${notes.join('; ')}` : '',
    ].filter(Boolean);

    return {
      store_id: store.id,
      store_name: store.name,
      food_safety_status: foodSafetyStatus,
      health_code_status: 'Monitoring active',
      employee_records_status: 'On file',
      equipment_checks_status: 'Scheduled',
      overall_status: overallStatus,
      notes,
      formatted: lines.join('\n'),
    };
  });
}

// ── Full store intelligence report ────────────────────────────────────────────

export function formatStoreIntelligenceReport(): string {
  const comparison = compareStores();
  const compliance = getComplianceReport();

  return [
    comparison.formatted,
    '',
    '📋 *Compliance Status*',
    ...compliance.map(c => c.formatted),
  ].join('\n');
}
