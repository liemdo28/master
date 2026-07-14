// Cross-Agent Intelligence Module
// Mi Company OS Executive Workflow System
// Status: SAFE_LOCAL_ORCHESTRATION

export * from "./agent-team-registry";
export * from "./agent-handoff-engine";
export * from "./agent-conflict-engine";
export * from "./agent-review-engine";
export * from "./cross-agent-orchestrator";
export * from "./agent-performance-scorecard";
export * from "./agent-evidence-chain";
export { default as crossAgentRouter } from "./cross-agent-router";

export const CROSS_AGENT_STATUS = "SAFE_LOCAL_ORCHESTRATION" as const;
export const MODULE_VERSION = "1.0.0" as const;
export const EVIDENCE_DIR = "mi-core/evidence/cross-agent" as const;

export default {
  agentTeamRegistry: () => import("./agent-team-registry"),
  agentHandoffEngine: () => import("./agent-handoff-engine"),
  agentConflictEngine: () => import("./agent-conflict-engine"),
  agentReviewEngine: () => import("./agent-review-engine"),
  crossAgentOrchestrator: () => import("./cross-agent-orchestrator"),
  agentPerformanceScorecard: () => import("./agent-performance-scorecard"),
  agentEvidenceChain: () => import("./agent-evidence-chain"),
  crossAgentRouter: () => import("./cross-agent-router"),
  status: "SAFE_LOCAL_ORCHESTRATION",
  version: "1.0.0",
};
