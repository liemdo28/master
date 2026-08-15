import type { JarvisResponse, JarvisSession, ProjectRecord } from '@/lib/types';
import { deriveContextState } from '@/lib/jarvis-workspace';

/**
 * Directive §5 — shows WHY Jarvis believes it has context, never WHAT secret
 * identity it has. Explicit context always visually outranks inferred/session
 * context (rendered first, more prominent). No device IDs, no API keys, no
 * raw auth identifiers, no session tokens are ever rendered here — only the
 * derived, already-safe fields already returned by the Gateway/session API.
 * The classification itself lives in lib/jarvis-workspace.ts's
 * deriveContextState() so it can be exhaustively unit-tested.
 */

function projectName(id: string | null, projects: ProjectRecord[]): string | null {
  if (!id) return null;
  return projects.find(p => p.id === id)?.displayName ?? id;
}

export function ContextIndicator({
  latest,
  requestedProjectId,
  session,
  projects,
}: {
  latest: JarvisResponse | null;
  requestedProjectId: string | null;
  session: JarvisSession | null;
  projects: ProjectRecord[];
}) {
  const { sessionKind: kind, explicitThisTurn, contextReused, clarificationRequired } = deriveContextState(latest, requestedProjectId);

  return (
    <section aria-label="Context" className="space-y-3 rounded-md border border-(--color-border) p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Context</h2>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-(--color-text-faint)">Session</dt>
          <dd className="text-(--color-text-dim)">
            {kind === 'none' && 'No session — each request is stateless'}
            {kind === 'device' && 'Command Center session (this device)'}
            {kind === 'explicit' && 'Shared session key (API caller-supplied)'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-(--color-text-faint)">Project — explicit this turn</dt>
          <dd className={explicitThisTurn ? 'font-medium text-(--color-text)' : 'text-(--color-text-faint)'}>
            {explicitThisTurn ? projectName(requestedProjectId, projects) : '— none supplied —'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-(--color-text-faint)">Project — session-derived</dt>
          <dd className="text-(--color-text-dim)">
            {session?.activeProjectId ? projectName(session.activeProjectId, projects) : '— none yet —'}
          </dd>
        </div>

        {contextReused && (
          <p className="rounded border border-(--color-accent)/30 bg-(--color-accent)/5 p-2 text-xs text-(--color-text-dim)">
            This answer reused the session's project context — no project was named this turn.
          </p>
        )}

        {clarificationRequired && (
          <p className="rounded border border-(--color-attention)/30 bg-(--color-attention)/5 p-2 text-xs text-(--color-text-dim)">
            Jarvis needed clarification this turn — neither an explicit project nor session context resolved one.
          </p>
        )}

        {session && (
          <div>
            <dt className="text-xs text-(--color-text-faint)">Session last active</dt>
            <dd className="text-(--color-text-dim)">{new Date(session.updatedAt).toLocaleString()}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
