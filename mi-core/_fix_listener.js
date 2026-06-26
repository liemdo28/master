// WhatsApp Routing Collision Fix - P0 (precise CRLF version)
const fs = require('fs');
const path = 'D:/Project/Master/mi-core/services/whatsapp-ai-gateway/src/whatsapp/message-listener.js';

let content = fs.readFileSync(path, 'utf8');
const original = content;
let changes = 0;

// FIX 1: Add return; inside if(!isAdmin) block (prevents fallthrough to GREETING)
const fix1_old = '    if (!isAdmin) {\r\n      log.info(\'[MESSAGE_FLOW] no_prefix_not_mi_non_ceo\', { ...runtimeTraceBase, route: \'chatbot_fallback\', phone });\r\n    } else {';
const fix1_new = '    if (!isAdmin) {\r\n      log.info(\'[MESSAGE_FLOW] no_prefix_non_ceo_silent_drop\', { ...runtimeTraceBase, route: \'no_prefix_silent_drop\', phone });\r\n      return; // P0 FIX: non-CEO no-prefix must NOT fall through to GREETING block\r\n    } else {';

if (content.includes(fix1_old)) {
  content = content.replace(fix1_old, fix1_new);
  console.log('FIX 1 applied: non-CEO silent drop');
  changes++;
} else {
  console.log('WARNING: FIX 1 pattern not found');
}

// FIX 2: Fix sendMiForwardResult condition — only send if forward succeeded
// Old: if (!sent && !forwardResult.ok) → sends error as "fallback"
// New: if (forwardResult.ok && forwardResult.reply && !sent) → only send real success
const fix2_old = '        if (!sent && !forwardResult.ok) {\r\n          log.warn(\'[MESSAGE_FLOW] no_prefix_mi_forward_failed_no_user_fallback\', { ...runtimeTraceBase, route: \'no_prefix_mi_forward\', error: forwardResult.error || \'\' });\r\n        }';
const fix2_new = '        if (forwardResult.ok && forwardResult.reply && !sent) {\r\n          // Forward succeeded but sendMiForwardResult suppressed (dedup/stale guard)\r\n          log.info(\'[MESSAGE_FLOW] no_prefix_mi_forward_suppressed\', { ...runtimeTraceBase, route: \'no_prefix_mi_forward_suppressed\' });\r\n        } else if (!forwardResult.ok) {\r\n          // Mi-core unreachable — silent drop, mi-core handles retry\r\n          log.warn(\'[MESSAGE_FLOW] no_prefix_mi_forward_failed_silent_drop\', { ...runtimeTraceBase, route: \'no_prefix_mi_forward_failed\', error: forwardResult.error || \'\' });\r\n        }';

if (content.includes(fix2_old)) {
  content = content.replace(fix2_old, fix2_new);
  console.log('FIX 2 applied: no error-reply fallback');
  changes++;
} else {
  console.log('WARNING: FIX 2 pattern not found');
  // Show what's actually there
  const idx = content.indexOf('no_prefix_mi_forward_failed_no_user_fallback');
  if (idx >= 0) {
    console.log('Found at:', JSON.stringify(content.slice(idx - 10, idx + 200)));
  }
}

// FIX 3: Block CEO from GREETING and generic AI (already applied by previous run)
const fix3_old = '  if (nlp.autoHandle && nlp.intent === \'GREETING\') {';
const fix3_new = '  // P0 FIX: CEO senders must NEVER receive generic greeting or generic AI reply\r\n  // Only Mi-Core may respond to CEO. This prevents collision when mi-core is slow.\r\n  if (miAccess.isCeoSender(phone)) {\r\n    log.info(\'[MESSAGE_FLOW] ceo_sender_blocked_from_generic_ai\', { ...runtimeTraceBase, route: \'ceo_generic_ai_blocked\' });\r\n    return; // CEO always routes to Mi. Never use generic AI or greeting.\r\n  }\r\n\r\n  if (nlp.autoHandle && nlp.intent === \'GREETING\') {';

if (content.includes(fix3_old) && !content.includes('ceo_sender_blocked_from_generic_ai')) {
  content = content.replace(fix3_old, fix3_new);
  console.log('FIX 3 applied: CEO blocked from GREETING');
  changes++;
} else if (content.includes('ceo_sender_blocked_from_generic_ai')) {
  console.log('FIX 3 already applied');
} else {
  console.log('WARNING: FIX 3 pattern not found');
}

if (content !== original) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('File written:', path);
  console.log('Changes:', changes);
  const origLines = original.split(/\r?\n/).length;
  const newLines = content.split(/\r?\n/).length;
  console.log('Lines:', origLines, '->', newLines);
} else {
  console.log('No changes made');
}
