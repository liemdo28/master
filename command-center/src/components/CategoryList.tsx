/** Renders FACTS / SUGGESTIONS / UNKNOWNS as visibly distinct categories (§4, §UX
 *  principles) — never merged into one undifferentiated bullet list. */

type Kind = 'fact' | 'suggestion' | 'unknown' | 'approval';

const KIND_STYLE: Record<Kind, { label: string; color: string; icon: string }> = {
  fact:       { label: 'FACT',       color: 'text-(--color-fact)',       icon: '●' },
  suggestion: { label: 'SUGGESTION', color: 'text-(--color-suggestion)', icon: '◆' },
  unknown:    { label: 'UNKNOWN',    color: 'text-(--color-unknown)',    icon: '?' },
  approval:   { label: 'APPROVAL',   color: 'text-(--color-approval)',   icon: '⏳' },
};

export function CategoryList({ kind, items, title }: { kind: Kind; items: string[]; title?: string }) {
  const style = KIND_STYLE[kind];
  if (items.length === 0) return null;
  return (
    <section aria-label={title ?? style.label}>
      <h3 className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide ${style.color}`}>
        <span aria-hidden="true">{style.icon}</span>
        {title ?? style.label}
      </h3>
      <ul className="space-y-1 text-sm text-(--color-text-dim)">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="mt-1 text-(--color-text-faint)">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
