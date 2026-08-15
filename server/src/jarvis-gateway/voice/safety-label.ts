/**
 * Phase 7F §14 — high-risk intent handling. A transcript naming a
 * not-authorized action (Gmail SEND, financial action, shell command,
 * deploy, browser write, desktop control, autonomous approval) is labeled
 * and answered BLOCKED/NOT_AUTHORIZED before it ever reaches
 * handleGatewayRequest() — not because the Gateway would otherwise grant
 * it (it structurally cannot: Phase 7C's ACTION_PROPOSAL never calls
 * `.propose()`/`.approve()`/`.execute()`, and no external action type
 * beyond GMAIL_CREATE_DRAFT/CALENDAR_EVENT_PROPOSAL/CALENDAR_CREATE_EVENT
 * exists anywhere in the governed set), but so voice gives an honest,
 * immediate answer instead of routing a request that could never succeed
 * through classification/clarification for no reason.
 *
 * This is a label, not a second authority decision — it must never be
 * "smarter" than the Gateway (i.e. it must never approve/allow something
 * the Gateway would have blocked); it only ever adds an earlier, more
 * honest rejection for a fixed set of never-authorized phrasings. §14 also
 * requires this must NOT translate a forbidden request into a "similar"
 * permitted one without explicit user intent — so on a match, the response
 * is a flat block, never a silent substitution.
 */
import type { VoiceSafetyLabel } from './types';

interface ForbiddenPattern {
  label: Exclude<VoiceSafetyLabel, 'SAFE'>;
  patterns: RegExp[];
}

// Patterns are intentionally broad (word-boundary, case-insensitive) — a
// false positive here just means an honest "not authorized" answer for a
// benign-but-similarly-worded request (recoverable: the user can rephrase),
// while a false negative would let a forbidden-intent transcript reach the
// Gateway unlabeled. Given the Gateway itself cannot execute any of these
// regardless, erring toward over-matching has no safety cost, only a UX one.
// Independent review of PR #109 found real false-negative gaps in an
// earlier version of this list (natural phrasings like "deploy the app to
// production", "email John about the launch", "purchase 10 shares of
// Apple", "run npm install", "press the login button", "launch Chrome",
// "auto approve everything from here on" all slipped through as SAFE).
// Broadened accordingly — the "over-matching has no safety cost" note
// above is exactly why these are now generous rather than narrowly tuned
// to specific example sentences.
const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    label: 'FORBIDDEN_GMAIL_SEND',
    patterns: [
      /\bsend\s+(the\s+|this\s+|that\s+)?(email|gmail|draft|message)\b/i,
      /\bgmail\s+send\b/i,
      /\breply\s+(to\s+)?(the\s+|this\s+)?(email|gmail)\b/i,
      /\bforward\s+(the\s+|this\s+)?(email|gmail)\b/i,
      // "email John about the launch" / "email the team with an update" —
      // "email" used as a verb, followed by a recipient and a connector.
      /\bemail\s+\w+(\s+\w+)?\s+(about|regarding|with|that|to\s+tell)\b/i,
    ],
  },
  {
    label: 'FORBIDDEN_FINANCIAL',
    patterns: [
      /\b(buy|sell|trade|purchase|transfer|withdraw|deposit)\s+([\w.$]+\s+)?(of\s+(the\s+)?)?(stock|shares?|crypto|bitcoin|funds?|money)\b/i,
      /\bmake\s+a\s+payment\b/i,
      /\bwire\s+(the\s+)?money\b/i,
      /\bplace\s+(an?\s+)?order\s+(for|to\s+buy|to\s+sell)\b/i,
      // "pay the invoice" / "pay this bill"
      /\bpay\s+(the\s+|this\s+|that\s+)?(invoice|bill)\b/i,
    ],
  },
  {
    label: 'FORBIDDEN_SHELL',
    patterns: [
      /\brun\s+(a\s+|the\s+)?(shell\s+)?command\b/i,
      /\bexecute\s+(this\s+|that\s+)?script\b/i,
      /\b(run|open)\s+(a\s+)?terminal\b/i,
      /\bsudo\b/i,
      // "run npm install" / "run yarn build" / "run docker ..." / "run git ..."
      /\brun\s+(npm|yarn|pip|docker|git)\b/i,
      // "kill the node process"
      /\bkill\s+(the\s+)?(\w+\s+)?process\b/i,
    ],
  },
  {
    label: 'FORBIDDEN_DEPLOY',
    patterns: [
      // A bare, standalone "deploy" (word-boundary on both sides — this
      // does not match "deployment"/"deployed"/"undeployed") is the
      // clearest, most reliable signal here; over-matching a genuine
      // question containing the word is an acceptable, recoverable UX
      // cost given the Gateway can never deploy anything regardless.
      /\bdeploy\b/i,
      /\bdeploying\b/i,
      /\bmerge\s+and\s+deploy\b/i,
      /\bpush\s+(this\s+|it\s+)?to\s+production\b/i,
      /\brelease\s+to\s+production\b/i,
    ],
  },
  {
    label: 'FORBIDDEN_BROWSER_WRITE',
    patterns: [
      // "press the login button" / "click the submit button" — allow one
      // optional descriptive word between "the" and the target noun.
      /\b(click|submit|press|tap|fill\s+(in|out))\s+(the\s+)?(\w+\s+)?(button|link|form|field)\b/i,
      /\bpost\s+(this\s+|that\s+)?(comment|reply|message)\s+(on|to)\b/i,
    ],
  },
  {
    label: 'FORBIDDEN_DESKTOP_CONTROL',
    patterns: [
      /\b(open|close|switch\s+to|control)\s+(the\s+)?(app|application|window|desktop)\b/i,
      /\btake\s+(a\s+)?screenshot\b/i,
      /\bmove\s+(the\s+)?mouse\b/i,
      // "launch Chrome" / "launch the browser" — scoped to app/browser-
      // shaped objects, not "launch the product" (an unrelated business
      // sense of the same verb).
      /\blaunch\s+(the\s+)?(app|application|browser|chrome|firefox|safari|edge)\b/i,
    ],
  },
  {
    label: 'FORBIDDEN_AUTONOMOUS_APPROVAL',
    patterns: [
      /\b(approve|authorize)\s+(it|this|that|everything|all)\s+(automatically|from\s+(now|here)\s+on|without\s+asking)\b/i,
      /\balways\s+approve\b/i,
      /\bskip\s+(the\s+)?approval\b/i,
      // "auto approve everything" / "auto-approve this"
      /\bauto[- ]?approve\b/i,
    ],
  },
];

export function classifyVoiceSafety(transcript: string): VoiceSafetyLabel {
  for (const { label, patterns } of FORBIDDEN_PATTERNS) {
    if (patterns.some(p => p.test(transcript))) return label;
  }
  return 'SAFE';
}

const SAFETY_MESSAGES: Record<Exclude<VoiceSafetyLabel, 'SAFE'>, string> = {
  FORBIDDEN_GMAIL_SEND: 'Sending or replying to email by voice is not authorized. I can prepare a draft for you to review and send yourself in Command Center.',
  FORBIDDEN_FINANCIAL: 'Financial actions are not authorized through voice or through Jarvis at all. Please handle this yourself directly.',
  FORBIDDEN_SHELL: 'Running shell commands by voice is not authorized.',
  FORBIDDEN_DEPLOY: 'Deploying or merging by voice is not authorized. Deploys require the full reviewed process, not a spoken request.',
  FORBIDDEN_BROWSER_WRITE: 'Interacting with web pages by voice is not authorized.',
  FORBIDDEN_DESKTOP_CONTROL: 'Controlling the desktop by voice is not authorized.',
  FORBIDDEN_AUTONOMOUS_APPROVAL: 'Voice cannot grant approval, automatic or otherwise. Every approval still requires the canonical approval UI in Command Center.',
};

export function safetyBlockMessage(label: Exclude<VoiceSafetyLabel, 'SAFE'>): string {
  return SAFETY_MESSAGES[label];
}
