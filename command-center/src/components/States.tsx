import type { ReactNode } from 'react';
import { ApiError, UnauthorizedError } from '@/lib/api-client';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 p-6 text-(--color-text-dim)">
      <span className="h-3 w-3 animate-pulse rounded-full bg-(--color-accent)" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-(--color-border) p-8 text-center text-(--color-text-dim)">
      <p className="font-medium text-(--color-text)">{title}</p>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div role="alert" className="rounded-lg border border-(--color-blocked)/30 bg-(--color-blocked)/5 p-4 text-(--color-blocked)">
      <p className="font-medium">Couldn't load this.</p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-(--color-blocked)/40 px-3 py-1 text-sm hover:bg-(--color-blocked)/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function UnauthorizedState() {
  return (
    <div role="alert" className="rounded-lg border border-(--color-approval)/30 bg-(--color-approval)/5 p-4 text-(--color-approval)">
      <p className="font-medium">Session expired.</p>
      <p className="mt-1 text-sm opacity-90">Please unlock again with your Mi PIN.</p>
    </div>
  );
}

export function NotConfiguredState({ hint }: { hint: string }) {
  return (
    <div className="rounded-lg border border-(--color-not-configured)/30 bg-(--color-not-configured)/5 p-4 text-(--color-text-dim)">
      <p className="font-medium text-(--color-text)">Not configured.</p>
      <p className="mt-1 text-sm">{hint}</p>
    </div>
  );
}

/** Central place every screen routes its query state through — never substitutes
 *  fabricated placeholder data for a real error (§27). */
export function DataBoundary({
  isLoading, error, isEmpty, emptyTitle, emptyHint, onRetry, children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) return <LoadingState />;
  if (error instanceof UnauthorizedError) return <UnauthorizedState />;
  if (error) return <ErrorState error={error instanceof ApiError ? error : error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle ?? 'Nothing here yet.'} hint={emptyHint} />;
  return <>{children}</>;
}
