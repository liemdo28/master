/**
 * End-of-day review builder — the single canonical EndOfDayReview builder, plus bounded
 * knowledge extraction (§10).
 *
 * Completion is never self-awarded: a task counts as completed only if Task Runtime
 * itself reports `status: 'COMPLETED'` with a `completedAt` on this date. A failed task
 * stays failed and a blocked task stays blocked in the review regardless of what else
 * happened that day — nothing here rewrites history.
 */

import { randomUUID } from 'crypto';
import type { TaskStore } from '../../task-runtime/store';
import type { PersonalOsStore } from '../store';
import type { DailyPlan, EndOfDayReview, KnowledgeCandidate, PlanTaskRef } from './types';

export interface ReviewDeps {
  taskStore: TaskStore;
  personalStore: PersonalOsStore;
}

const REJECT_PATTERNS: RegExp[] = [
  /[A-Za-z]:[\\/][^\s]+/,          // absolute Windows path
  /\/(?:home|tmp|var|usr)\/[^\s]+/i, // absolute *nix path
  /\bat\s+[\w.$]+\s*\(.*:\d+:\d+\)/, // stack trace frame
  /\b[0-9a-f]{32,}\b/i,             // hex token/hash
  /^(task|doc|chunk|goal|plan|brief)-[0-9a-f-]{8,}$/i, // a bare id, nothing else
  /^(system|assistant|user):/i,     // looks like a model instruction/role prefix
];

function isRejectedCandidate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return true; // too generic to be a real lesson
  return REJECT_PATTERNS.some(p => p.test(trimmed));
}

/** §10: bounded, deduplicated, never auto-activated. */
export function extractKnowledgeCandidates(deps: ReviewDeps, failedItems: Array<{ id: string; title: string; reason: string }>, blockedItems: PlanTaskRef[]): KnowledgeCandidate[] {
  const existingTitles = new Set(deps.personalStore.listKnowledge(true).map(k => k.title.toLowerCase().trim()));
  const out: KnowledgeCandidate[] = [];
  const seen = new Set<string>();

  for (const item of failedItems) {
    const summary = item.reason?.trim();
    if (!summary || isRejectedCandidate(summary)) continue;
    const title = `Lesson: ${item.title.slice(0, 80)}`;
    const key = title.toLowerCase();
    if (existingTitles.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: 'LESSON_LEARNED', title, summary: summary.slice(0, 500), evidenceReferences: [`task:${item.id}`], needsConfirmation: true });
    if (out.length >= 10) return out;
  }

  // Recurring blockers: group by the *current* resultSummary from Task Runtime, not the
  // plan snapshot's reason (which reflects the tier at plan time, not why it's blocked).
  const byReason = new Map<string, { count: number; ids: string[] }>();
  for (const item of blockedItems) {
    if (item.sourceType !== 'TASK' || !item.sourceId) continue;
    const task = deps.taskStore.getTask(item.sourceId);
    const reason = task?.resultSummary?.trim();
    if (!reason || isRejectedCandidate(reason)) continue;
    const entry = byReason.get(reason) ?? { count: 0, ids: [] };
    entry.count += 1; entry.ids.push(item.sourceId);
    byReason.set(reason, entry);
  }
  for (const [reason, entry] of byReason) {
    if (entry.count < 2) continue;
    const title = `Recurring blocker: ${reason.slice(0, 80)}`;
    const key = title.toLowerCase();
    if (existingTitles.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: 'RECURRING_ISSUE', title, summary: `Blocked ${entry.count} time(s): ${reason}`.slice(0, 500), evidenceReferences: entry.ids.map(id => `task:${id}`), needsConfirmation: true });
    if (out.length >= 10) return out;
  }

  return out;
}

/** The only code path allowed to build an EndOfDayReview. Idempotent per date (§17). */
export function buildEndOfDayReview(deps: ReviewDeps & { operatingStore: import('./store').OperatingStore }, date: string, plan: DailyPlan | null): EndOfDayReview {
  const existing = deps.operatingStore.latestReviewForDate(date);
  if (existing) return existing;

  const planned = plan?.selectedTasks ?? [];
  const taskItems = planned.filter(t => t.sourceType === 'TASK');

  const completedItems: EndOfDayReview['completedItems'] = [];
  const incompleteItems: PlanTaskRef[] = [];
  const blockedItems: PlanTaskRef[] = [];
  const failedItems: EndOfDayReview['failedItems'] = [];

  for (const ref of taskItems) {
    const task = deps.taskStore.getTask(ref.sourceId!);
    if (!task) { incompleteItems.push(ref); continue; }
    if (task.status === 'COMPLETED' && task.completedAt?.slice(0, 10) === date) {
      completedItems.push({ id: task.id, title: ref.title, evidenceReference: `task:${task.id}` });
    } else if (task.status === 'FAILED') {
      failedItems.push({ id: task.id, title: ref.title, reason: (task.resultSummary || 'failed with no recorded summary').slice(0, 300), evidenceReference: `task:${task.id}` });
    } else if (task.status === 'BLOCKED') {
      blockedItems.push(ref);
    } else {
      incompleteItems.push(ref);
    }
  }

  const knowledgeCandidates = extractKnowledgeCandidates(deps, failedItems, blockedItems);

  const facts: string[] = [
    `${completedItems.length}/${taskItems.length} planned task(s) completed today.`,
    `${failedItems.length} task(s) failed.`,
    `${blockedItems.length} task(s) remain blocked.`,
  ];
  const unknowns: string[] = plan ? [] : [`no daily plan existed for ${date}; review is based on Task Runtime state alone.`];

  const review: EndOfDayReview = {
    id: `opreview-${randomUUID()}`,
    date, planId: plan?.id ?? null,
    plannedItems: planned, completedItems, incompleteItems, blockedItems, failedItems,
    decisions: [],
    lessons: knowledgeCandidates.filter(c => c.kind === 'LESSON_LEARNED').map(c => c.title),
    recurringIssues: knowledgeCandidates.filter(c => c.kind === 'RECURRING_ISSUE').map(c => c.title),
    knowledgeCandidates,
    unresolvedFollowUps: [],
    tomorrowSuggestions: [
      ...blockedItems.slice(0, 3).map(b => `Unblock: ${b.title}`),
      ...incompleteItems.slice(0, 3).map(i => `Carry over: ${i.title}`),
    ].slice(0, 5),
    facts, suggestions: knowledgeCandidates.length ? [`${knowledgeCandidates.length} knowledge candidate(s) await confirmation before they are trusted.`] : [],
    unknowns,
    evidenceReferences: [...completedItems.map(c => c.evidenceReference), ...failedItems.map(f => f.evidenceReference)].slice(0, 30),
    generatedAt: new Date().toISOString(), version: 1,
  };

  return deps.operatingStore.saveReview(review);
}
