/**
 * ContextResolver.mjs
 * Assembles full execution context for any CEO message.
 * Resolves: store, people, file hints, action type, urgency.
 */

import { StoreMemory }   from './StoreMemory.mjs';
import { PeopleMemory }  from './PeopleMemory.mjs';
import { ContactResolver } from './ContactResolver.mjs';
import { OwnerProfileMemory } from './OwnerProfileMemory.mjs';

export class ContextResolver {
  /**
   * Resolve full context from a message.
   * Returns everything the ActionPlanner needs.
   */
  static resolve(message) {
    const msg = message;

    // Resolve store mentions
    const resolvedStore = StoreMemory.resolve(msg);

    // Resolve person mentions (for send/assign/meeting)
    const personNames = extractPersonMentions(msg);
    const resolvedPeople = personNames.map(n => PeopleMemory.resolve(n)).filter(Boolean);

    // Resolve primary contact (for actions like "send to David")
    const recipientName = extractRecipient(msg);
    const resolvedContact = recipientName ? ContactResolver.resolve(recipientName) : null;

    // Detect action type
    const actionType = detectActionType(msg);

    // Detect urgency
    const isUrgent = /urgent|khẩn|asap|ngay|immediately|gấp/i.test(msg);

    // Owner context
    const owner = OwnerProfileMemory.get();

    return {
      message,
      actionType,
      resolvedStore,
      resolvedPeople,
      resolvedContact,
      isUrgent,
      owner,
      // Convenience flags
      hasStore:   !!resolvedStore,
      hasContact: !!resolvedContact?.resolved,
      needsContactClarification: resolvedContact && !resolvedContact.resolved,
      storeContext: resolvedStore ? StoreMemory.getContextString(resolvedStore.id) : null,
    };
  }

  /**
   * Build context string for AI injection
   */
  static buildContextString(message) {
    const ctx = this.resolve(message);
    const parts = [];

    if (ctx.resolvedStore) {
      parts.push(`[Store Context] ${ctx.storeContext}`);
    }
    if (ctx.resolvedPeople.length > 0) {
      parts.push(`[People] ${ctx.resolvedPeople.map(p => `${p.name} (${p.role})`).join(', ')}`);
    }
    if (ctx.resolvedContact?.resolved) {
      parts.push(`[Contact] ${ctx.resolvedContact.name} <${ctx.resolvedContact.email}> via ${ctx.resolvedContact.source}`);
    }
    if (ctx.needsContactClarification) {
      parts.push(`[⚠️ Contact Unclear] ${ctx.resolvedContact.message}`);
    }
    if (ctx.isUrgent) {
      parts.push(`[Urgency] CEO marked as urgent`);
    }

    return parts.join('\n');
  }
}

function extractPersonMentions(msg) {
  // Extract names that could be people (capitalized or known names)
  const known = ['maria', 'hoang', 'nguyen', 'nguyên', 'david', 'sen'];
  const found = [];
  const m = msg.toLowerCase();
  for (const name of known) {
    if (m.includes(name)) found.push(name);
  }
  // Also extract "cho [CapitalName]" patterns
  const capMatch = msg.match(/\b(?:cho|for|with|với)\s+([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƯỞ][a-zàáâãèéêìíòóôõùúýăđươởẹặ]+)/g) || [];
  for (const m of capMatch) {
    const name = m.replace(/^(?:cho|for|with|với)\s+/i, '').toLowerCase();
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

function extractRecipient(msg) {
  // "gửi cho David", "send to David", "for Maria"
  const m = msg.match(/(?:gửi\s+cho|send\s+to|cho|for|với|with)\s+([A-ZÀ-Ỹa-zà-ỹ][a-zà-ỹ]+)/i);
  return m ? m[1] : null;
}

function detectActionType(msg) {
  const m = msg.toLowerCase();
  if (/tìm file|find file|search file/.test(m)) return 'find-file';
  if (/gửi.*cho|send.*to/.test(m) && /file|report|báo cáo/.test(m)) return 'find-and-send';
  if (/gửi email|send email/.test(m)) return 'send-email';
  if (/tạo meeting|create meeting|schedule meeting|tạo lịch/.test(m)) return 'create-event';
  if (/tạo task|create task|giao task|giao việc/.test(m)) return 'create-task';
  if (/upload.*drive|lên drive/.test(m)) return 'upload-drive';
  if (/lên lịch post|schedule post|tạo post/.test(m)) return 'schedule-post';
  if (/overdue|quá hạn/.test(m)) return 'check-overdue';
  if (/email|thư/.test(m)) return 'check-email';
  if (/calendar|lịch|meeting/.test(m)) return 'check-calendar';
  if (/task.*nào|who.*task/.test(m)) return 'check-tasks';
  return 'general-query';
}
