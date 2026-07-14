import * as fs from "fs";
import * as path from "path";

const EVIDENCE_DIR = path.join("d:", "Project", "Master", "mi-core", "evidence", "cross-agent");

// Evidence Chain Types
export interface EvidenceRecord {
  id: string;
  agentId: string;
  action: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  timestamp: string;
  objectiveId?: string;
  handoffId?: string;
}

let evidenceCounter = 0;

class AgentEvidenceChain {
  private records: EvidenceRecord[] = [];
  private evidenceFile: string;

  constructor() {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
    this.evidenceFile = path.join(EVIDENCE_DIR, "evidence-log.jsonl");
  }

  logAgentAction(agentId: string, action: string, input: unknown, output: unknown, durationMs: number): EvidenceRecord {
    const record: EvidenceRecord = {
      id: "ev-" + Date.now() + "-" + (++evidenceCounter),
      agentId,
      action,
      input,
      output,
      durationMs,
      timestamp: new Date().toISOString(),
    };
    this.records.push(record);
    // Append-only to JSONL
    fs.appendFileSync(this.evidenceFile, JSON.stringify(record) + "\n", "utf-8");
    return record;
  }

  getEvidenceChain(objectiveId: string): EvidenceRecord[] {
    return this.records.filter(r => r.objectiveId === objectiveId);
  }

  getAllRecords(): EvidenceRecord[] {
    return [...this.records];
  }

  exportEvidence(): EvidenceRecord[] {
    return [...this.records];
  }

  getEvidenceFile(): string {
    return this.evidenceFile;
  }
}

export const agentEvidenceChain = new AgentEvidenceChain();
export default agentEvidenceChain;
