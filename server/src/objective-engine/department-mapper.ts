/**
 * Phase 25A — Department Mapper
 * Maps intent category → responsible departments in the company.
 */

import type { Department, IntentAnalysis, IntentCategory } from './types';

const CATEGORY_DEPARTMENT_MAP: Record<IntentCategory, Department[]> = {
  'traffic-growth': ['seo', 'content', 'local-seo', 'web-engineering', 'analytics', 'marketing'],
  'revenue-growth': ['marketing', 'finance', 'analytics', 'web-engineering', 'content'],
  'brand-expansion': ['marketing', 'content', 'local-seo', 'operations'],
  'operational-optimization': ['operations', 'web-engineering', 'analytics', 'finance'],
  'risk-mitigation': ['operations', 'web-engineering', 'compliance', 'finance'],
  'compliance': ['compliance', 'web-engineering', 'operations'],
  'customer-experience': ['review-management', 'marketing', 'content', 'operations'],
  'technology-upgrade': ['web-engineering', 'operations', 'analytics'],
};

// Always include reporting and executive-assistant
const ALWAYS_INCLUDE: Department[] = ['reporting', 'executive-assistant'];

export function mapDepartments(intent: IntentAnalysis): Department[] {
  const baseSet = new Set<Department>(CATEGORY_DEPARTMENT_MAP[intent.category] || ['operations']);
  for (const dept of ALWAYS_INCLUDE) baseSet.add(dept);

  // Add business-specific departments based on entity
  if (intent.businessEntity !== 'company') {
    // Brand entity → always involve content + marketing + analytics
    baseSet.add('content');
    baseSet.add('marketing');
    baseSet.add('analytics');
  }

  return Array.from(baseSet);
}
