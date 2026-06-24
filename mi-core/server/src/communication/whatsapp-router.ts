/**
 * WhatsApp Communication Router — routes normalized messages to the correct handler.
 * Sits between the raw webhook and Mi-Core Brain.
 *
 * Flow:
 *   NormalizedMessage → CommandRouter → [BigData|Node|Store|...] handler
 *                     → Brain Pipeline (for free-form text)
 *                     → ResponseFormatter → WhatsApp reply
 */

import { NormalizedMessage } from './message-normalizer';
import { helpText, findCommand } from './command-registry';
import { formatList, formatError } from './response-formatter';
import { auditConversation } from './conversation-audit';

export interface RouterResult {
  reply: string;
  intent: string;
  route: string;
  approval_required: boolean;
  approval_id: string | null;
  duration_ms: number;
}

// Lazy imports to avoid circular deps
async function getBigDataHealth() {
  try {
    const res = await fetch('http://127.0.0.1:' + (process.env.MI_PORT || 4001) + '/api/bigdata/health');
    return res.ok ? await res.json() as Record<string, string> : null;
  } catch { return null; }
}

async function getNodeStatus(nodeId?: string): Promise<string> {
  try {
    const res = await fetch('http://127.0.0.1:' + (process.env.MI_PORT || 4001) + '/api/nodes/status');
    if (!res.ok) return 'Node controller not available.';
    const data = await res.json() as { nodes?: Array<{ node_id: string; status: string; projects?: number }> };
    const nodes = data.nodes || [];
    if (!nodes.length) return 'No nodes registered.';
    if (nodeId) {
      const n = nodes.find(x => x.node_id === nodeId);
      return n ? `Node ${nodeId}: ${n.status}, ${n.projects ?? 0} projects` : `Node ${nodeId} not found.`;
    }
    return formatList('Nodes', nodes.map(n => `${n.node_id}: ${n.status}`));
  } catch { return 'Node controller not reachable.'; }
}

export async function routeWhatsAppMessage(
  msg: NormalizedMessage,
): Promise<RouterResult> {
  const start = Date.now();
  let reply = '';
  let intent = 'unknown';
  let route = 'fallthrough';
  let approval_required = false;
  let approval_id: string | null = null;

  try {
    const cmd = msg.command;

    // ── Help ──────────────────────────────────────────────────────────────
    if (cmd === 'help' || cmd === '?' || cmd === 'h') {
      reply = helpText(msg.language === 'vi' ? 'vi' : 'en');
      intent = 'help';
      route = 'command:help';
    }

    // ── Big Data ──────────────────────────────────────────────────────────
    else if (cmd === 'bigdata' || cmd === 'bd') {
      const h = await getBigDataHealth();
      if (!h) {
        reply = formatError('Big Data không phản hồi. Chạy: docker-compose up -d');
        intent = 'bigdata_health';
        route = 'command:bigdata';
      } else {
        const status = (k: string) => h[k] === 'ok' ? '✅' : '❌ ' + h[k];
        reply = [
          '*Big Data Health*',
          `PostgreSQL: ${status('postgres')}`,
          `MinIO: ${status('minio')}`,
          `Qdrant: ${status('qdrant')}`,
          `Overall: ${h.overall === 'ok' ? '✅ OK' : '❌ ' + h.overall}`,
        ].join('\n');
        intent = 'bigdata_health';
        route = 'command:bigdata';
      }
    }

    // ── Nodes ─────────────────────────────────────────────────────────────
    else if (cmd === 'nodes' || cmd === 'node') {
      reply = await getNodeStatus();
      intent = 'nodes_status';
      route = 'command:nodes';
    }

    else if (cmd === 'laptop1' || cmd === 'l1') {
      reply = await getNodeStatus('laptop1');
      intent = 'node_laptop1';
      route = 'command:laptop1';
    }

    else if (cmd === 'laptop2' || cmd === 'l2') {
      reply = await getNodeStatus('laptop2');
      intent = 'node_laptop2';
      route = 'command:laptop2';
    }

    // ── Unknown registered command — forward to brain ─────────────────────
    else {
      const cmdDef = cmd ? findCommand(cmd) : null;
      if (cmdDef) {
        // Known command but handled elsewhere (ceo-command-router / pipeline)
        route = `command:${cmd}`;
        intent = `ceo_${cmd}`;
      } else {
        route = 'brain_pipeline';
        intent = 'free_text';
      }
      reply = ''; // signal to caller to use brain pipeline
    }
  } catch (err) {
    reply = formatError('Mi gặp lỗi. Thử lại sau.');
    intent = 'error';
    route = 'error';
  }

  const duration_ms = Date.now() - start;

  auditConversation({
    id: msg.message_id + '_' + Date.now(),
    timestamp: msg.timestamp,
    sender: msg.sender,
    chat_id: msg.chat_id,
    message_id: msg.message_id,
    raw_text: msg.raw,
    normalized_text: msg.text,
    language: msg.language,
    intent,
    route,
    response_preview: reply.slice(0, 200),
    duration_ms,
    approval_required,
    approval_id,
    error: null,
  });

  return { reply, intent, route, approval_required, approval_id, duration_ms };
}
