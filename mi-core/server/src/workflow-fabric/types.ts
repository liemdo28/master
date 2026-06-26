export type WorkflowRisk = 'READ_ONLY' | 'SAFE_WRITE' | 'PRODUCTION_WRITE' | 'FINANCIAL' | 'SECURITY';
export type WorkflowRunStatus = 'REGISTERED' | 'SKIP_DUPLICATE';

export interface WorkflowFingerprintInput {
  project: string;
  entity: string;
  action: string;
  time_window: string;
}

export interface WorkflowRegistryEntry {
  workflow_id: string;
  workflow_name: string;
  project: string;
  division: string;
  owner: string;
  trigger: string;
  schedule: string;
  risk: WorkflowRisk;
  approval_required: boolean;
  status: string;
  last_run: string | null;
  next_run: string | null;
}

export interface WorkflowDedupResult {
  status: WorkflowRunStatus;
  fingerprint: string;
  fingerprint_key: string;
  reason: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface WorkflowEvidenceRecord {
  workflow_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: string;
  input: unknown;
  output: unknown;
  errors: string[];
  evidence: string[];
}
