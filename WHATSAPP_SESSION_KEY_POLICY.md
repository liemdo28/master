# WhatsApp Session Key Policy — Phase 21.7

## Canonical Session Key

Every WhatsApp session MUST use:

```
chat_id + sender_phone + owner
```

### NEVER use:

- `chat_id` alone (causes cross-user collision)
- `sender_phone` alone (causes cross-chat collision)
- Any global variable (causes cross-workflow collision)

### Owner Values

| Owner | When Used |
|-------|-----------|
| `mi_core` | CEO direct chat — any /mi, no-prefix, or CEO-identified message |
| `food_safety` | Food safety group images, active food safety session |
| `marketing_preview` | Active draft preview session only |
| `approval` | Active approval checklist session only |
| `team_support` | Support group messages |
| `unknown` | No matching handler — silent drop |

### Lock Rule

Only ONE owner can be active per `chat_id + sender_phone` at any time.

When a new owner claims the session, all other owners are automatically closed:

```
centralSessionManager.setSession({
  chatId,
  senderPhone,
  owner: 'mi_core',
  workflow: 'ceo_no_prefix'
})
// → automatically closes food_safety, marketing_preview, approval, team_support
```

### CEO Priority

When the sender is the CEO, owner MUST be `mi_core`. All other sessions for that chat+sender are closed immediately.

### Trace Events

All session transitions are traced with:

```
SESSION_SET — new owner claimed
SESSION_CLOSED — explicit close
OWNER_BLOCKED — handler tried to respond but different owner is active
OWNER_CLOSED — previous owner replaced by new owner
```
