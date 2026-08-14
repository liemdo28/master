/** Color-independent status indicator (§26: color alone must never carry the
 *  meaning) — every status pairs a shape/icon with its color and always shows text. */

const STYLE: Record<string, { dot: string; text: string; bg: string; icon: string }> = {
  HEALTHY:          { dot: 'bg-(--color-healthy)',       text: 'text-(--color-healthy)',       bg: 'bg-(--color-healthy)/10',       icon: '●' },
  ATTENTION:        { dot: 'bg-(--color-attention)',     text: 'text-(--color-attention)',     bg: 'bg-(--color-attention)/10',     icon: '▲' },
  BLOCKED:          { dot: 'bg-(--color-blocked)',       text: 'text-(--color-blocked)',       bg: 'bg-(--color-blocked)/10',       icon: '■' },
  DOWN:             { dot: 'bg-(--color-down)',          text: 'text-(--color-down)',          bg: 'bg-(--color-down)/10',          icon: '✕' },
  FAILED:           { dot: 'bg-(--color-down)',          text: 'text-(--color-down)',          bg: 'bg-(--color-down)/10',          icon: '✕' },
  NOT_CONFIGURED:   { dot: 'bg-(--color-not-configured)', text: 'text-(--color-not-configured)', bg: 'bg-(--color-not-configured)/10', icon: '○' },
  UNKNOWN:          { dot: 'bg-(--color-not-configured)', text: 'text-(--color-not-configured)', bg: 'bg-(--color-not-configured)/10', icon: '?' },
  // Phase 7B — health/dependency truth model states.
  DEGRADED:         { dot: 'bg-(--color-attention)',     text: 'text-(--color-attention)',     bg: 'bg-(--color-attention)/10',     icon: '▲' },
  UNAVAILABLE:      { dot: 'bg-(--color-down)',          text: 'text-(--color-down)',          bg: 'bg-(--color-down)/10',          icon: '✕' },
  DISCONNECTED:     { dot: 'bg-(--color-not-configured)', text: 'text-(--color-not-configured)', bg: 'bg-(--color-not-configured)/10', icon: '○' },
  INTENTIONALLY_DISABLED: { dot: 'bg-(--color-text-faint)', text: 'text-(--color-text-faint)',  bg: 'bg-white/5',                    icon: '⊘' },
  DRAFT:            { dot: 'bg-(--color-unknown)',       text: 'text-(--color-text-dim)',      bg: 'bg-white/5',                    icon: '◇' },
  APPROVED:         { dot: 'bg-(--color-accent)',        text: 'text-(--color-accent)',        bg: 'bg-(--color-accent)/10',        icon: '✓' },
  ACTIVE:           { dot: 'bg-(--color-fact)',          text: 'text-(--color-fact)',          bg: 'bg-(--color-fact)/10',          icon: '▶' },
  COMPLETED:        { dot: 'bg-(--color-fact)',          text: 'text-(--color-fact)',          bg: 'bg-(--color-fact)/10',          icon: '✓' },
  CANCELLED:        { dot: 'bg-(--color-text-faint)',    text: 'text-(--color-text-faint)',    bg: 'bg-white/5',                    icon: '⊘' },
  PAUSED:           { dot: 'bg-(--color-suggestion)',    text: 'text-(--color-suggestion)',    bg: 'bg-(--color-suggestion)/10',    icon: '❚❚' },
  WAITING_APPROVAL: { dot: 'bg-(--color-approval)',      text: 'text-(--color-approval)',      bg: 'bg-(--color-approval)/10',      icon: '⏳' },
  READY:            { dot: 'bg-(--color-accent)',        text: 'text-(--color-accent)',        bg: 'bg-(--color-accent)/10',        icon: '●' },
  RUNNING:          { dot: 'bg-(--color-fact)',          text: 'text-(--color-fact)',          bg: 'bg-(--color-fact)/10',          icon: '▶' },
  FRESH:            { dot: 'bg-(--color-healthy)',       text: 'text-(--color-healthy)',       bg: 'bg-(--color-healthy)/10',       icon: '●' },
  STALE:            { dot: 'bg-(--color-attention)',     text: 'text-(--color-attention)',     bg: 'bg-(--color-attention)/10',     icon: '▲' },
  PARTIAL:          { dot: 'bg-(--color-attention)',     text: 'text-(--color-attention)',     bg: 'bg-(--color-attention)/10',     icon: '◐' },
  NOT_GENERATED:    { dot: 'bg-(--color-not-configured)', text: 'text-(--color-not-configured)', bg: 'bg-(--color-not-configured)/10', icon: '○' },
  // Phase 7C — Jarvis Gateway response statuses.
  ANSWERED:         { dot: 'bg-(--color-healthy)',       text: 'text-(--color-healthy)',       bg: 'bg-(--color-healthy)/10',       icon: '●' },
  NEEDS_CLARIFICATION: { dot: 'bg-(--color-attention)',  text: 'text-(--color-attention)',     bg: 'bg-(--color-attention)/10',     icon: '?' },
  NO_SUPPORTED_ANSWER: { dot: 'bg-(--color-not-configured)', text: 'text-(--color-not-configured)', bg: 'bg-(--color-not-configured)/10', icon: '○' },
  CONFLICT:         { dot: 'bg-(--color-attention)',     text: 'text-(--color-attention)',     bg: 'bg-(--color-attention)/10',     icon: '⚡' },
  SIMULATED:        { dot: 'bg-(--color-suggestion)',    text: 'text-(--color-suggestion)',    bg: 'bg-(--color-suggestion)/10',    icon: '◈' },
  PROPOSAL_READY:   { dot: 'bg-(--color-accent)',        text: 'text-(--color-accent)',        bg: 'bg-(--color-accent)/10',        icon: '◆' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STYLE[status] ?? STYLE.UNKNOWN;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
      role="status"
    >
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span>{label ?? status.replace(/_/g, ' ')}</span>
    </span>
  );
}
