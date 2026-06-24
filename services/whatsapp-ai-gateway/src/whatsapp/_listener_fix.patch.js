// PATCH: Add these 6 lines at line ~888 in message-listener.js
// Replace the unclosed block:
      } else {
        // Mi-core unreachable or returned no reply — silent drop, mi-core handles retry
        log.warn('[MESSAGE_FLOW] no_prefix_mi_forward_failed_silent_drop', {
          ...runtimeTraceBase,
          route: 'no_prefix_mi_forward_failed',
          ok: forwardResult.ok,
          hasReply: !!forwardResult?.reply,
          error: forwardResult.error || '',
        });
      }
    }
    return; // FIX: Always return after no-prefix handling. Never fall through to GREETING.
  }

  // ── CEO P0 FIX: Block GREETING + generic AI for CEO senders ──────────────────
  // CEO messages must NOT be answered with generic greeting or generic AI.
  // Only Mi-Core may respond to CEO. This prevents collision when mi-core is slow.
  if (miAccess.isCeoSender(phone)) {
    log.info('[MESSAGE_FLOW] ceo_sender_blocked_from_generic_ai', { ...runtimeTraceBase, route: 'ceo_generic_ai_blocked' });
    return; // CEO always routes to Mi. Never use generic AI or greeting.
  }

  if (nlp.autoHandle && nlp.intent === 'GREETING') {
