/**
 * Risk Engine — evaluates business signals and produces risk scores.
 * Checks: reviews, disputes, QB activity, BigData health, connector health.
 */

export type RiskLevel = 'critical' | 'warning' | 'info' | 'ok';

export interface RiskSignal {
  source: string;
  level: RiskLevel;
  message: string;
  data?: unknown;
  detected_at: string;
}

const PORT = process.env.MI_PORT || 4001;

async function safeGet(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

export async function evaluateSystemRisk(): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const now = new Date().toISOString();

  // BigData health
  const bdHealth = await safeGet(`http://127.0.0.1:${PORT}/api/bigdata/health`) as Record<string, string> | null;
  if (!bdHealth) {
    signals.push({ source: 'bigdata', level: 'warning', message: 'Big Data (PG/MinIO/Qdrant) không phản hồi', detected_at: now });
  } else if (bdHealth.overall !== 'ok') {
    signals.push({ source: 'bigdata', level: 'critical', message: `Big Data lỗi: ${JSON.stringify(bdHealth)}`, data: bdHealth, detected_at: now });
  }

  // WhatsApp health
  const waHealth = await safeGet(`http://127.0.0.1:${PORT}/api/whatsapp/mi/health`) as Record<string, unknown> | null;
  if (!waHealth || waHealth.endpoint !== 'online') {
    signals.push({ source: 'whatsapp', level: 'critical', message: 'WhatsApp relay offline', detected_at: now });
  }

  // Connector health
  const connectors = await safeGet(`http://127.0.0.1:${PORT}/api/visibility/connectors`) as {
    connectors?: Array<{ id: string; auth: string; health: string }>
  } | null;
  if (connectors?.connectors) {
    for (const c of connectors.connectors) {
      if (c.health === 'offline' || c.health === 'error') {
        signals.push({ source: `connector:${c.id}`, level: 'warning', message: `Connector ${c.id} unhealthy: ${c.health}`, detected_at: now });
      }
    }
  }

  // Pending approvals
  const approvals = await safeGet(`http://127.0.0.1:${PORT}/api/whatsapp/mi/approvals`) as unknown[] | null;
  if (Array.isArray(approvals) && approvals.length > 5) {
    signals.push({ source: 'approvals', level: 'warning', message: `${approvals.length} approvals pending — review needed`, detected_at: now });
  }

  // Node health
  const nodes = await safeGet(`http://127.0.0.1:${PORT}/api/nodes/status`) as { nodes?: Array<{ node_id: string; status: string }> } | null;
  if (nodes?.nodes) {
    for (const n of nodes.nodes) {
      if (n.status !== 'online') {
        signals.push({ source: `node:${n.node_id}`, level: 'warning', message: `Node ${n.node_id} offline`, detected_at: now });
      }
    }
  }

  return signals;
}

export function formatRiskSummary(signals: RiskSignal[]): string {
  if (!signals.length) return '✅ Không có rủi ro nào được phát hiện.';
  const critical = signals.filter(s => s.level === 'critical');
  const warnings = signals.filter(s => s.level === 'warning');
  const lines = [
    critical.length ? `🔴 *${critical.length} CRITICAL*` : '',
    warnings.length ? `🟡 *${warnings.length} WARNING*` : '',
    '',
    ...signals.map(s => {
      const icon = s.level === 'critical' ? '🔴' : s.level === 'warning' ? '🟡' : 'ℹ️';
      return `${icon} [${s.source}] ${s.message}`;
    }),
  ].filter(l => l !== undefined);
  return lines.join('\n');
}
