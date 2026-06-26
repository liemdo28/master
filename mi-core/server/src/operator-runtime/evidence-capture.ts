import fs from 'fs';
import path from 'path';
import { OperatorEvidenceRecord, OperatorTaskInput, OperatorTaskResult, PolicyDecision, OperatorAdapter, OperatorMode } from './types';
import { redactSensitiveObject } from './redaction';

const EVIDENCE_ROOT = path.join(process.cwd(), '.local-agent-global', 'operator-runtime', 'evidence');

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

export function captureEvidence(params: {
  task_id: string;
  objective_id: string;
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
}): string[] {
  const evidencePaths: string[] = [];

  const record: OperatorEvidenceRecord = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  const { clean: redactedRecord } = redactSensitiveObject(record);

  const logPath = path.join(EVIDENCE_ROOT, `${params.task_id}`, `log.json`);
  ensureDir(logPath);
  fs.writeFileSync(logPath, JSON.stringify(redactedRecord, null, 2), 'utf-8');
  evidencePaths.push(logPath);

  if (params.screenshots.length > 0) {
    const screenshotListPath = path.join(EVIDENCE_ROOT, `${params.task_id}`, `screenshots.json`);
    const { clean: redactedScreenshots } = redactSensitiveObject(params.screenshots);
    fs.writeFileSync(screenshotListPath, JSON.stringify(redactedScreenshots, null, 2), 'utf-8');
    evidencePaths.push(screenshotListPath);
  }

  if (params.downloads.length > 0) {
    const downloadListPath = path.join(EVIDENCE_ROOT, `${params.task_id}`, `downloads.json`);
    const { clean: redactedDownloads } = redactSensitiveObject(params.downloads);
    fs.writeFileSync(downloadListPath, JSON.stringify(redactedDownloads, null, 2), 'utf-8');
    evidencePaths.push(downloadListPath);
  }

  return evidencePaths;
}
