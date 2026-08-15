import type { TruthStatus } from '@/lib/jarvis-workspace';

/** The strict operator-visible status vocabulary (directive §6) — a
 *  deliberately separate style map from StatusBadge's domain-status map, so
 *  OBSERVED/INFERRED/PROPOSED/APPROVAL_REQUIRED/BLOCKED/EXECUTED can never
 *  visually collide with an unrelated domain status of the same color. */
const STYLE: Record<TruthStatus, { dot: string; text: string; bg: string; icon: string; label: string }> = {
  OBSERVED:          { dot: 'bg-(--color-fact)',       text: 'text-(--color-fact)',       bg: 'bg-(--color-fact)/10',       icon: '●', label: 'OBSERVED' },
  INFERRED:          { dot: 'bg-(--color-suggestion)', text: 'text-(--color-suggestion)', bg: 'bg-(--color-suggestion)/10', icon: '◈', label: 'INFERRED' },
  PROPOSED:          { dot: 'bg-(--color-accent)',     text: 'text-(--color-accent)',     bg: 'bg-(--color-accent)/10',     icon: '◆', label: 'PROPOSED' },
  APPROVAL_REQUIRED: { dot: 'bg-(--color-approval)',   text: 'text-(--color-approval)',   bg: 'bg-(--color-approval)/10',   icon: '⏳', label: 'APPROVAL REQUIRED' },
  BLOCKED:           { dot: 'bg-(--color-blocked)',    text: 'text-(--color-blocked)',    bg: 'bg-(--color-blocked)/10',    icon: '■', label: 'BLOCKED' },
  EXECUTED:          { dot: 'bg-(--color-healthy)',    text: 'text-(--color-healthy)',    bg: 'bg-(--color-healthy)/10',    icon: '✓', label: 'EXECUTED' },
};

export function TruthStatusBadge({ status }: { status: TruthStatus }) {
  const s = STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
      role="status"
    >
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span>{s.icon} {s.label}</span>
    </span>
  );
}
