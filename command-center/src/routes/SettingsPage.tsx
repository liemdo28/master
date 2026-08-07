import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRemote } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { DataBoundary } from '@/components/States';
import { formatDateTime } from '@/lib/format';

interface Device { device_id: string; name: string; ip: string; first_seen: string; last_seen: string; revoked: boolean }
interface AuditEntry { ts: string; device_id: string; ip: string; action: string; result: string; detail?: string }

export function SettingsPage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const devices = useQuery({ queryKey: ['remote', 'devices'], queryFn: () => apiRemote.get<{ devices: Device[] }>('/devices') });
  const audit = useQuery({ queryKey: ['remote', 'audit'], queryFn: () => apiRemote.get<{ log: AuditEntry[] }>('/audit?limit=30') });

  const revoke = useMutation({
    mutationFn: (id: string) => apiRemote.del(`/devices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remote', 'devices'] }),
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Settings</h1>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Session</h2>
        <button onClick={logout} className="rounded-md border border-(--color-blocked)/40 px-3 py-1.5 text-sm text-(--color-blocked) hover:bg-(--color-blocked)/10">
          Lock this session
        </button>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Trusted devices</h2>
        <DataBoundary isLoading={devices.isLoading} error={devices.error} isEmpty={(devices.data?.devices.length ?? 0) === 0} emptyTitle="No devices recorded.">
          <ul className="space-y-1.5">
            {(devices.data?.devices ?? []).map(d => (
              <li key={d.device_id} className="flex items-center justify-between rounded-md border border-(--color-border) px-3 py-2 text-sm">
                <div>
                  <p className="text-(--color-text)">{d.name} {d.revoked && <span className="text-(--color-blocked)">(revoked)</span>}</p>
                  <p className="text-xs text-(--color-text-faint)">{d.ip} · last seen {formatDateTime(d.last_seen)}</p>
                </div>
                {!d.revoked && (
                  <button onClick={() => revoke.mutate(d.device_id)} disabled={revoke.isPending} className="rounded-md border border-(--color-border) px-2 py-1 text-xs text-(--color-text-dim) hover:border-(--color-blocked) hover:text-(--color-blocked)">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </DataBoundary>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Access audit log</h2>
        <DataBoundary isLoading={audit.isLoading} error={audit.error} isEmpty={(audit.data?.log.length ?? 0) === 0} emptyTitle="No audit entries.">
          <ul className="space-y-1 text-xs text-(--color-text-dim)">
            {(audit.data?.log ?? []).map((a, i) => (
              <li key={i} className="flex justify-between border-b border-(--color-border)/50 py-1">
                <span>{a.action} · {a.result}</span>
                <span className="text-(--color-text-faint)">{formatDateTime(a.ts)}</span>
              </li>
            ))}
          </ul>
        </DataBoundary>
      </section>
    </div>
  );
}
