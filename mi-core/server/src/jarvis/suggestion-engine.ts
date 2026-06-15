/**
 * Suggestion Engine — generates actionable suggestions from risk signals.
 * CEO can approve suggestions via WhatsApp.
 */

import { RiskSignal } from './risk-engine';

export interface Suggestion {
  id: string;
  type: 'draft_reply' | 'investigate' | 'restart_service' | 'create_task' | 'alert_team';
  title: string;
  description: string;
  whatsapp_prompt: string;   // what to send CEO in WhatsApp
  approval_required: boolean;
  risk_level: 1 | 2 | 3;
  auto_action?: string;      // command to run if approved
}

export function generateSuggestions(signals: RiskSignal[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = Date.now();

  for (const signal of signals) {
    const id = `sug_${now}_${signal.source.replace(/[^a-z0-9]/g, '_')}`;

    if (signal.source === 'bigdata' && signal.level === 'critical') {
      suggestions.push({
        id, type: 'restart_service',
        title: 'Khởi động lại Big Data infra',
        description: 'PostgreSQL/MinIO/Qdrant không phản hồi. Cần khởi động lại Docker.',
        whatsapp_prompt: '⚠️ Big Data lỗi — PostgreSQL/MinIO/Qdrant không phản hồi. Anh xác nhận cho em khởi động lại Docker infra không? (approve ' + id + ')',
        approval_required: true,
        risk_level: 2,
        auto_action: 'docker-compose -f infra/bigdata/docker-compose.yml up -d',
      });
    }

    if (signal.source === 'whatsapp' && signal.level === 'critical') {
      suggestions.push({
        id, type: 'investigate',
        title: 'Kiểm tra WhatsApp relay',
        description: 'WhatsApp relay offline. Kiểm tra whatsapp-api service.',
        whatsapp_prompt: '🔴 WhatsApp relay offline. Kiểm tra laptop 1 — service whatsapp-api-key.',
        approval_required: false,
        risk_level: 1,
      });
    }

    if (signal.source.startsWith('connector:')) {
      const connector = signal.source.split(':')[1];
      suggestions.push({
        id, type: 'investigate',
        title: `Kiểm tra connector ${connector}`,
        description: signal.message,
        whatsapp_prompt: `🟡 Connector ${connector} có vấn đề. Anh nhắn "kiểm tra ${connector}" — em sẽ xem ngay.`,
        approval_required: false,
        risk_level: 1,
      });
    }

    if (signal.source === 'approvals') {
      suggestions.push({
        id, type: 'alert_team',
        title: 'Nhiều approval đang chờ',
        description: signal.message,
        whatsapp_prompt: `🟡 Có nhiều approval đang chờ. Anh nhắn "cần duyệt gì?" — em sẽ liệt kê ngay.`,
        approval_required: false,
        risk_level: 1,
      });
    }
  }

  return suggestions;
}
