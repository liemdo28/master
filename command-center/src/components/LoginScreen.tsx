import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';

export function LoginScreen() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(pin);
    setSubmitting(false);
    if (!result.ok) setError(result.error ?? 'Could not log in.');
    else setPin('');
  }

  return (
    <div className="flex h-full items-center justify-center bg-(--color-bg)">
      <form onSubmit={onSubmit} className="w-full max-w-xs rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
        <h1 className="mb-1 text-lg font-semibold text-(--color-text)">Mi Command Center</h1>
        <p className="mb-4 text-sm text-(--color-text-dim)">Enter your PIN to unlock.</p>
        <label htmlFor="pin" className="sr-only">PIN</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoFocus
          autoComplete="off"
          value={pin}
          onChange={e => setPin(e.target.value)}
          className="w-full rounded-md border border-(--color-border) bg-(--color-bg) px-3 py-2 text-(--color-text) outline-none focus-visible:border-(--color-accent)"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-(--color-blocked)">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting || !pin}
          className="mt-4 w-full rounded-md bg-(--color-accent) px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
