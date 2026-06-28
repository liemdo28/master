/**
 * orchestrator.js — Phase 13 Multi-Agent Workforce orchestrator.
 *
 * Wires the team registry + handoff/conflict/review engines + performance
 * scorecard into one dispatch cycle:
 *
 *   task arrives
 *     -> route to best-fit agent (capability + load + perf)
 *     -> mark load
 *     -> (optional) peer review of the work
 *     -> on review fail -> handoff to a stronger agent
 *     -> release load, refresh scorecard
 *
 * Phase 13 still does not execute side-effects against production; it only
 * models assignment, review, and handoff. Safe execution is Phase 14/15.
 */
import { AgentTeamRegistry } from './team.js';
import { HandoffEngine, ConflictEngine, ReviewEngine, PerformanceScorecard } from './engines.js';

export class MultiAgentWorkforce {
  constructor(opts = {}) {
    this.team = new AgentTeamRegistry(opts);
    this.handoff = new HandoffEngine(opts);
    this.conflict = new ConflictEngine(opts);
    this.review = new ReviewEngine(opts);
    this.performance = new PerformanceScorecard(this.review, opts);
  }

  dispatch(task) {
    const routing = this.team.route(task, this.performance);
    if (!routing) {
      return { routed: false, reason: 'no agent with matching capability + capacity', task };
    }
    this.team.addLoad(routing.agent.id);
    return { routed: true, task, agent: routing.agent, reason: routing.reason };
  }

  /** Peer-review the work product of an agent on a task. */
  peerReview({ taskId, workAgentId, reviewerAgentId, score, verdict, notes }) {
    const result = this.review.review({ taskId, workAgentId, reviewerAgentId, score, verdict, notes });
    this.team.releaseLoad(workAgentId);
    this.performance.refresh();
    return result;
  }

  /** Failed review -> hand off to a better agent (if any). */
  escalateAfterFail(task, failedAgentId, reviewerAgentId, notes) {
    // Make the failed agent temporarily offline so routing picks a different one.
    const prev = this.team.get(failedAgentId);
    if (prev) this.team.store.update(failedAgentId, { status: 'offline' });
    const re = this.dispatch(task);
    let handoffRec = null;
    if (re.routed && re.agent.id !== failedAgentId) {
      handoffRec = this.handoff.handoff({
        taskId: task.id,
        fromAgentId: failedAgentId,
        toAgentId: re.agent.id,
        reason: `review failed by ${reviewerAgentId}: ${notes || 'low score'}`,
        context: { reviewerAgentId },
      });
    }
    // restore the failed agent availability after escalation (best-effort).
    if (prev) this.team.store.update(failedAgentId, { status: 'available' });
    return { reDispatch: re, handoff: handoffRec };
  }

  /** Resolve two agents claiming the same exclusive resource. */
  resolveResourceConflict(claims) {
    return this.conflict.resolveOverResource(claims);
  }

  scorecard() {
    return this.performance.refresh();
  }
}

export default MultiAgentWorkforce;
