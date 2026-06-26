export type OperatorMode = 'READ_ONLY' | 'SAFE_WRITE_TEST_ONLY' | 'PRODUCTION_WRITE' | 'FINANCIAL_ACTION' | 'SECURITY_ACTION' | 'CREDENTIAL_ACTION';
export type OperatorAdapter = 'playwright';
export type OperatorTargetType = 'web';
export type TaskStatus = 'PENDING' | 'DISPATCHED' | 'IN_PROGRESS' | 'DONE' | 'FAILED' | 'BLOCKED_BY_POLICY';
export type OperatorActionType =
  | 'navigate'
  | 'read_title'
  | 'read_text'
  | 'click'
  | 'fill'
  | 'screenshot'
  | 'download'
  | 'upload_test_file'
  | 'wait'
  | 'extract_links';

export interface OperatorTarget {
  type: OperatorTargetType;
  url: string;
  category?: string;
}

export interface OperatorAction {
  type: OperatorActionType;
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  timeout_ms?: number;
  path?: string;
  filename?: string;
  submit?: boolean;
}

export interface OperatorTaskInput {
  task_id: string;
  objective_id: string;
  mode: OperatorMode;
  adapter: OperatorAdapter;
  target: OperatorTarget;
  actions: OperatorAction[];
  evidence_required: boolean;
}

export interface OperatorTaskResult {
  ok: boolean;
  task_id: string;
  status: TaskStatus;
  result?: Record<string, unknown>;
  evidence?: string[];
  reason?: string;
  errors?: string[];
  coordination?: Record<string, unknown>;
}

export interface PolicyDecision {
  ok: boolean;
  status: TaskStatus | 'ALLOWED';
  reason: string;
  matched_rules: string[];
}

export interface OperatorEvidenceRecord {
  task_id: string;
  objective_id: string;
  timestamp: string;
  adapter: OperatorAdapter;
  mode: OperatorMode;
  target_url: string;
  policy_decision: PolicyDecision;
  task_input: OperatorTaskInput;
  task_output?: OperatorTaskResult;
  execution_log: Array<Record<string, unknown>>;
  screenshots: string[];
  downloads: string[];
  html_snapshot?: string;
  timing_ms: number;
  errors: string[];
}

export interface StoredTaskRecord {
  id: string;
  created_at: string;
  updated_at: string;
  input: OperatorTaskInput;
  output?: OperatorTaskResult;
  status: TaskStatus;
  evidence: string[];
  coordination: {
    checked: boolean;
    available: boolean;
    status_updates: string[];
    evidence_registered: boolean;
  };
}

export interface CoordinationCheckResult {
  exists: boolean;
  source: 'api' | 'mock';
  available: boolean;
  details?: Record<string, unknown>;
}
