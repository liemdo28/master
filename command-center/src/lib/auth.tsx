import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/** Session token storage: sessionStorage, not localStorage — cleared when the tab
 *  closes, never persisted across browser restarts or shared across long-lived
 *  storage. This is the "avoid localStorage" compromise from §22: some in-memory-only
 *  persistence is unavoidable for a page reload to not force a re-login every time,
 *  but the token never survives beyond the tab's lifetime. */
const STORAGE_KEY = 'mi_cc_session';

export type AuthState = 'unknown' | 'locked' | 'authenticated';

interface AuthContextValue {
  state: AuthState;
  token: string | null;
  login: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  lock: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable (private mode) — session just won't survive reload */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [state, setState] = useState<AuthState>(() => (readStoredToken() ? 'authenticated' : 'locked'));

  const login = useCallback(async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/remote/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token) {
        return { ok: false, error: body.error || `Login failed (${res.status})` };
      }
      writeStoredToken(body.token);
      setToken(body.token);
      setState('authenticated');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Cannot reach Mi Core — is the server running?' };
    }
  }, []);

  const logout = useCallback(() => {
    const t = readStoredToken();
    writeStoredToken(null);
    setToken(null);
    setState('locked');
    if (t) {
      fetch('/api/remote/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => { /* best effort */ });
    }
  }, []);

  const lock = useCallback(() => {
    writeStoredToken(null);
    setToken(null);
    setState('locked');
  }, []);

  return (
    <AuthContext.Provider value={{ state, token, login, logout, lock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
