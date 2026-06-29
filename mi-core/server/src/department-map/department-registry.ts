/**
 * department-registry.ts
 * Single source of truth for all departments and their ownership boundaries.
 */
export type DepartmentId =
  | 'executive'
  | 'finance'
  | 'operations'
  | 'marketing'
  | 'creative'
  | 'it'
  | 'engineering'
  | 'data-platform'
  | 'security'
  | 'customer-experience'
  | 'hr-labor'
  | 'procurement';

export interface Department {
  id: DepartmentId;
  name: string;
  owns: string[]; // objectives/tasks this dept owns
  supports: string[]; // objectives/tasks this dept can support
  primary_contact: string;
  parent: DepartmentId | null; // for hierarchy
}

export const DEPARTMENTS: Record<DepartmentId, Department> = {
  executive: {
    id: 'executive',
    name: 'Executive',
    owns: [
      'Increase Raw Sushi online revenue 10%',
      'Company strategy',
      'Approval authority',
      'Executive reporting',
    ],
    supports: ['finance', 'marketing', 'operations', 'it'],
    primary_contact: 'CEO',
    parent: null,
  },
  finance: {
    id: 'finance',
    name: 'Finance',
    owns: [
      'Baseline revenue analysis',
      'QuickBooks sync',
      'Payroll processing',
      'Tax compliance',
      'Financial reporting',
    ],
    supports: ['operations', 'marketing'],
    primary_contact: 'CFO',
    parent: 'executive',
  },
  operations: {
    id: 'operations',
    name: 'Operations',
    owns: [
      'DoorDash campaign management',
      'Food safety compliance',
      'Store health monitoring',
      'Store operations',
    ],
    supports: ['marketing', 'finance'],
    primary_contact: 'COO',
    parent: 'executive',
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    owns: [
      'SEO optimization',
      'Review monitoring',
      'GBP performance',
      'Traffic analysis',
    ],
    supports: ['operations'],
    primary_contact: 'CMO',
    parent: 'executive',
  },
  creative: {
    id: 'creative',
    name: 'Creative',
    owns: ['Creative asset production', 'Brand asset management'],
    supports: ['marketing', 'operations'],
    primary_contact: 'Creative Director',
    parent: 'marketing',
  },
  it: {
    id: 'it',
    name: 'IT',
    owns: [
      'System health monitoring',
      'OSS health check',
      'Duplicate task detection',
      'n8n workflow management',
      'Connector infrastructure',
    ],
    supports: ['executive', 'finance', 'operations', 'marketing'],
    primary_contact: 'CTO',
    parent: 'executive',
  },
  engineering: {
    id: 'engineering',
    name: 'Engineering',
    owns: ['Browser automation', 'Coding brain selection'],
    supports: ['it'],
    primary_contact: 'VP Engineering',
    parent: 'it',
  },
  'data-platform': {
    id: 'data-platform',
    name: 'Data Platform',
    owns: ['Data analytics', 'DuckDB operations', 'OSS data pipeline'],
    supports: ['finance', 'executive'],
    primary_contact: 'Data Lead',
    parent: 'it',
  },
  security: {
    id: 'security',
    name: 'Security',
    owns: ['Access control', 'Audit logging', 'Secret management'],
    supports: ['it', 'finance'],
    primary_contact: 'Security Lead',
    parent: 'it',
  },
  'customer-experience': {
    id: 'customer-experience',
    name: 'Customer Experience',
    owns: ['Customer feedback', 'Sentiment analysis', 'CX reporting'],
    supports: ['marketing', 'operations'],
    primary_contact: 'CX Lead',
    parent: 'marketing',
  },
  'hr-labor': {
    id: 'hr-labor',
    name: 'HR / Labor',
    owns: ['Staff scheduling', 'Labor cost tracking', 'HR compliance'],
    supports: ['finance', 'operations'],
    primary_contact: 'HR Lead',
    parent: 'executive',
  },
  procurement: {
    id: 'procurement',
    name: 'Procurement',
    owns: ['Vendor management', 'Ingredient sourcing', 'COGS tracking'],
    supports: ['finance', 'operations'],
    primary_contact: 'Procurement Lead',
    parent: 'finance',
  },
};

export function getDepartment(id: DepartmentId): Department {
  return DEPARTMENTS[id];
}

export function canOwn(id: DepartmentId, task: string): boolean {
  return DEPARTMENTS[id].owns.some((t) => t.toLowerCase().includes(task.toLowerCase()));
}

export function canSupport(id: DepartmentId, task: string): boolean {
  return DEPARTMENTS[id].supports.some((t) => t.toLowerCase().includes(task.toLowerCase()));
}

export function resolveOwner(task: string): DepartmentId {
  for (const [id, dept] of Object.entries(DEPARTMENTS)) {
    if (canOwn(id as DepartmentId, task)) return id as DepartmentId;
  }
  return 'executive'; // fallback to executive
}
