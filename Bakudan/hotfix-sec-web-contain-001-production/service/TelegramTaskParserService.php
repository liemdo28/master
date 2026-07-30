<?php
/**
 * TelegramTaskParserService — rule-based intent detection + entity extraction.
 *
 * Used by TelegramIntentClassifier as the fallback layer when OpenAI is
 * unavailable or for hard slash-commands (always handled here).
 *
 * Intents:
 *   start, connect, today_cmd, overdue_cmd, help  — slash commands
 *   greeting      — hi, hello, hey, xin chào …
 *   connect_help  — "connect telegram", "link my account" …
 *   today_tasks   — "what do I have today?" …
 *   overdue_tasks — "show overdue" …
 *   create_task   — task with a detectable date
 *   query_task    — "when is X due?" …
 *   unknown       — catch-all
 */
class TelegramTaskParserService {

    // ── Constants ──────────────────────────────────────────────────────────────

    private const MONTHS = [
        'january'=>1,'february'=>2,'march'=>3,'april'=>4,'may'=>5,'june'=>6,
        'july'=>7,'august'=>8,'september'=>9,'october'=>10,'november'=>11,'december'=>12,
        'jan'=>1,'feb'=>2,'mar'=>3,'apr'=>4,'jun'=>6,'jul'=>7,
        'aug'=>8,'sep'=>9,'oct'=>10,'nov'=>11,'dec'=>12,
    ];

    private const WEEKDAYS = [
        'monday'=>1,'tuesday'=>2,'wednesday'=>3,'thursday'=>4,
        'friday'=>5,'saturday'=>6,'sunday'=>0,
        'mon'=>1,'tue'=>2,'wed'=>3,'thu'=>4,'fri'=>5,'sat'=>6,'sun'=>0,
    ];

    private const CREATE_TRIGGERS = [
        'i need to', 'need to', 'please create', 'create task', 'add task',
        'remind me to', 'schedule', 'create a task', 'tao task', 'nhắc tôi',
        'đặt lịch', 'thêm task', 'thêm công việc',
    ];

    private const ASSIGN_TRIGGERS = [
        'assign to', 'assigned to', 'giao cho', 'for user', '→', 'cho',
    ];

    // Standalone reassign triggers — full message is ONLY about reassigning
    private const REASSIGN_STANDALONE = [
        // English
        '/^(?:please\s+)?(?:re)?assign\s+(?:this\s+)?(?:task\s+)?to\s+(.+)$/i',
        // Vietnamese
        '/^giao\s+lại\s+cho\s+(.+)$/i',
        '/^chuyển\s+(?:task\s+)?cho\s+(.+)$/i',
        '/^đổi\s+(?:người\s+(?:phụ\s+trách|nhận)\s+)?(?:sang|cho)\s+(.+)$/i',
        '/^(?:re)?assign\s+(?:this\s+to)\s+(.+)$/i',
    ];

    // Explicit-reference reassign: "assign task TITLE to NAME"
    private const REASSIGN_EXPLICIT_PATTERN =
        '/^(?:please\s+)?(?:re)?assign\s+(?:task\s+)?"?(.+?)"?\s+to\s+([^"]+)$/i';

    private const QUERY_TRIGGERS = [
        'when is', 'when does', 'when will', 'what is the deadline',
        'what is the due date', 'due date for', 'deadline for',
        'when should', 'khi nào', 'hạn chót', 'hạn nộp', 'ngày hết hạn',
    ];

    private const GREETING_WORDS = [
        'hi', 'hello', 'hey', 'howdy', 'hiya', 'greetings',
        'good morning', 'good afternoon', 'good evening',
        'xin chào', 'chào', 'chao', 'alo',
    ];

    private const CONNECT_TRIGGERS = [
        'connect telegram', 'link telegram', 'liên kết telegram', 'kết nối telegram',
        'connect account', 'link account', 'connect my account', 'link my account',
        'how to connect', 'how do i connect', 'làm sao kết nối', 'how connect',
        'telegram connect', 'liên kết tài khoản',
    ];

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Parse raw text into intent + entities.
     */
    public function parse(string $text): array {
        $text  = trim($text);
        $lower = mb_strtolower($text);

        // ── Slash commands (fastest path) ─────────────────────────────────────
        if ($text !== '' && $text[0] === '/') {
            return $this->parseCommand($text, $lower);
        }

        // ── Reassign (check BEFORE create/query — may contain "assign to") ────
        $reassign = $this->detectReassignIntent($text);
        if ($reassign) return $reassign;

        // ── Greeting ──────────────────────────────────────────────────────────
        if ($this->isGreeting($lower)) {
            return $this->result('greeting', $text);
        }

        // ── Connect help ──────────────────────────────────────────────────────
        if ($this->isConnectHelp($lower)) {
            return $this->result('connect_help', $text);
        }

        // ── Natural language: today / overdue ─────────────────────────────────
        if (preg_match('/\b(today|hôm nay|what do i have|công việc hôm nay)\b/', $lower)) {
            return $this->result('today_tasks', $text);
        }
        if (preg_match('/\b(overdue|quá hạn|late tasks|trễ hạn|quá hạn rồi)\b/', $lower)) {
            return $this->result('overdue_tasks', $text);
        }

        // ── Detect create vs query ────────────────────────────────────────────
        $isQuery  = $this->containsAny($lower, self::QUERY_TRIGGERS);
        $isCreate = $this->containsAny($lower, self::CREATE_TRIGGERS)
                 || preg_match('/\bon\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2})/i', $lower);

        if (!$isQuery && !$isCreate) {
            $date = $this->extractDate($text);
            if ($date) {
                $isCreate = true;
            } elseif (str_contains($text, '?') || str_starts_with($lower, 'when')) {
                $isQuery = true;
            }
        }

        // ── Extract entities ──────────────────────────────────────────────────
        $storeHint    = $this->extractStoreHint($text);
        $dueDate      = $this->extractDate($text);
        $project      = $this->inferProject($lower);
        $assigneeHint = $this->extractAssigneeHint($text);
        $title        = $this->extractTitle($text, $lower, $assigneeHint);

        if ($isQuery) {
            return array_merge($this->result('query_task', $text), [
                'store_hint'   => $storeHint,
                'project_hint' => $project,
                'query_terms'  => $this->extractQueryTerms($lower),
            ]);
        }

        if ($isCreate) {
            $missing = [];
            if (!$title)    $missing[] = 'title';
            if (!$dueDate)  $missing[] = 'due_date';

            return array_merge($this->result('create_task', $text), [
                'title'         => $title,
                'due_date'      => $dueDate,
                'store_hint'    => $storeHint,
                'project_hint'  => $project,
                'assignee_hint' => $assigneeHint,
                'missing'       => $missing,
            ]);
        }

        return $this->result('unknown', $text);
    }

    // ── Date extraction ───────────────────────────────────────────────────────

    /**
     * Extract a date from text. Returns YYYY-MM-DD or null.
     *
     * Handles:
     *   - Absolute: "April 23", "Apr 23", "23 April", "23/4", "2025-04-23"
     *   - Relative: "tomorrow", "next Friday", "this Wednesday",
     *               "in 3 days", "in 2 weeks", "next week", "end of month"
     *   - Vietnamese: "ngày mai", "tuần sau"
     */
    public function extractDate(string $text): ?string {
        $lower = mb_strtolower($text);
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');

        // ── Relative: tomorrow / ngày mai ─────────────────────────────────────
        if (preg_match('/\b(tomorrow|ngày mai|ngay mai)\b/', $lower)) {
            return date('Y-m-d', strtotime($today . ' +1 day'));
        }

        // ── Relative: day after tomorrow ─────────────────────────────────────
        if (preg_match('/\b(day after tomorrow|2 days from now)\b/', $lower)) {
            return date('Y-m-d', strtotime($today . ' +2 days'));
        }

        // ── Relative: in N days / in N weeks ──────────────────────────────────
        if (preg_match('/\bin\s+(\d+)\s+(day|days|ngày)\b/', $lower, $m)) {
            return date('Y-m-d', strtotime($today . ' +' . (int)$m[1] . ' days'));
        }
        if (preg_match('/\bin\s+(\d+)\s+(week|weeks|tuần)\b/', $lower, $m)) {
            return date('Y-m-d', strtotime($today . ' +' . ((int)$m[1] * 7) . ' days'));
        }

        // ── Relative: next week / tuần sau ────────────────────────────────────
        if (preg_match('/\b(next week|tuần sau|tuần tới)\b/', $lower)) {
            return date('Y-m-d', strtotime($today . ' +7 days'));
        }

        // ── Relative: end of month ────────────────────────────────────────────
        if (preg_match('/\b(end of (the )?month|cuối tháng)\b/', $lower)) {
            return date('Y-m-t', strtotime($today)); // t = last day of month
        }

        // ── Relative: next [weekday] / this [weekday] ─────────────────────────
        foreach (self::WEEKDAYS as $dayName => $dayNum) {
            if (preg_match('/\bnext\s+' . preg_quote($dayName, '/') . '\b/', $lower)) {
                return $this->nextWeekday($dayNum, true);
            }
            if (preg_match('/\bthis\s+' . preg_quote($dayName, '/') . '\b/', $lower)) {
                return $this->nextWeekday($dayNum, false);
            }
            // Plain weekday mention: "Friday" / "on Friday" when no other date found
            if (preg_match('/\bon\s+' . preg_quote($dayName, '/') . '\b/', $lower)) {
                return $this->nextWeekday($dayNum, false);
            }
        }

        // ── Absolute: "April 23" / "Apr 23" ──────────────────────────────────
        foreach (self::MONTHS as $name => $num) {
            if (preg_match('/\b' . preg_quote($name, '/') . '\s+(\d{1,2})\b/i', $lower, $m)) {
                return $this->nextUpcomingDate($num, (int)$m[1]);
            }
            // "23 April" / "23rd of April"
            if (preg_match('/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?' . preg_quote($name, '/') . '\b/i', $lower, $m)) {
                return $this->nextUpcomingDate($num, (int)$m[1]);
            }
        }

        // ── Absolute: "23/4" or "4/23" ────────────────────────────────────────
        if (preg_match('/\b(\d{1,2})\/(\d{1,2})\b/', $text, $m)) {
            $a = (int)$m[1]; $b = (int)$m[2];
            if ($a >= 1 && $a <= 31 && $b >= 1 && $b <= 12) {
                return $this->nextUpcomingDate($b, $a); // d/m
            }
            if ($b >= 1 && $b <= 31 && $a >= 1 && $a <= 12) {
                return $this->nextUpcomingDate($a, $b); // m/d
            }
        }

        // ── Absolute: "YYYY-MM-DD" ────────────────────────────────────────────
        if (preg_match('/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/', $text, $m)) {
            return sprintf('%04d-%02d-%02d', (int)$m[1], (int)$m[2], (int)$m[3]);
        }

        return null;
    }

    // ── Store hint extraction ──────────────────────────────────────────────────

    public function extractStoreHint(string $text): ?string {
        try {
            $db     = Database::getInstance();
            $stores = $db->fetchAll("SELECT id, name FROM stores WHERE is_active = 1 ORDER BY LENGTH(name) DESC");
        } catch (\Throwable $e) {
            return null;
        }

        $lower = mb_strtolower($text);
        foreach ($stores as $s) {
            $sName = mb_strtolower($s['name']);
            if (str_contains($lower, $sName)) return $s['name'];
            // Short-name match: first word of "Raw Stockton" = "Raw"
            $words = explode(' ', $sName);
            if (count($words) > 1 && strlen($words[0]) >= 3 && str_contains($lower, $words[0])) {
                return $s['name'];
            }
        }
        return null;
    }

    // ── Project inference ─────────────────────────────────────────────────────

    public function inferProject(string $lower): string {
        foreach ($this->financeKeywords() as $kw) {
            if (str_contains($lower, $kw)) {
                return defined('TELEGRAM_FINANCE_PROJECT_NAME') ? TELEGRAM_FINANCE_PROJECT_NAME : 'Finance';
            }
        }
        return defined('TELEGRAM_DEFAULT_PROJECT_NAME') ? TELEGRAM_DEFAULT_PROJECT_NAME : 'General';
    }

    // ── Assignee hint extraction ──────────────────────────────────────────────

    public function extractAssigneeHint(string $text): ?string {
        foreach (self::ASSIGN_TRIGGERS as $trigger) {
            if (preg_match('/' . preg_quote($trigger, '/') . '\s+([A-ZÀ-Ỹa-zà-ỹ][A-ZÀ-Ỹa-zà-ỹ\s]{1,40}?)(?:\s+(?:on|by|before|deadline|due)|[,\.]|$)/iu', $text, $m)) {
                return trim($m[1]);
            }
            if (preg_match('/' . preg_quote($trigger, '/') . '\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)/iu', $text, $m)) {
                return trim($m[1]);
            }
        }
        if (preg_match('/@([A-Za-z][A-Za-z0-9_]{1,30})/', $text, $m)) {
            return $m[1];
        }
        return null;
    }

    // ── Title extraction ──────────────────────────────────────────────────────

    public function extractTitle(string $text, string $lower, ?string $assigneeHint = null): ?string {
        $clean = $text;

        // Remove assignee phrases
        if ($assigneeHint) {
            foreach (self::ASSIGN_TRIGGERS as $trigger) {
                $clean = preg_replace('/' . preg_quote($trigger, '/') . '\s+' . preg_quote($assigneeHint, '/') . '/iu', '', $clean);
            }
            $clean = preg_replace('/@' . preg_quote($assigneeHint, '/') . '/u', '', $clean);
        }

        // Remove trigger phrases
        foreach (self::CREATE_TRIGGERS as $trigger) {
            $clean = preg_replace('/\b' . preg_quote($trigger, '/') . '\b/i', '', $clean);
        }

        // Remove relative date phrases
        $relativePhrases = [
            'tomorrow', 'ngày mai', 'day after tomorrow', 'next week', 'tuần sau', 'tuần tới',
            'end of month', 'cuối tháng',
        ];
        foreach ($relativePhrases as $phrase) {
            $clean = preg_replace('/\b' . preg_quote($phrase, '/') . '\b/i', '', $clean);
        }
        $clean = preg_replace('/\bin\s+\d+\s+(day|days|week|weeks|ngày|tuần)\b/i', '', $clean);
        $clean = preg_replace('/\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i', '', $clean);

        // Remove absolute date phrases
        foreach (self::MONTHS as $name => $_) {
            $clean = preg_replace('/\b(?:on\s+)?' . preg_quote($name, '/') . '\s+\d{1,2}\b/i', '', $clean);
            $clean = preg_replace('/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?' . preg_quote($name, '/') . '\b/i', '', $clean);
        }
        $clean = preg_replace('/\bon\s+\d{1,2}\/\d{1,2}\b/i', '', $clean);
        $clean = preg_replace('/\b\d{4}-\d{2}-\d{2}\b/', '', $clean);

        $clean = preg_replace('/\s{2,}/', ' ', $clean);
        $clean = trim($clean, " \t\n\r\0\x0B,.");

        if (strlen($clean) > 1) {
            $clean = mb_strtoupper(mb_substr($clean, 0, 1)) . mb_substr($clean, 1);
        }

        return strlen($clean) >= 3 ? $clean : null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // ── Reassign detection ────────────────────────────────────────────────────

    /**
     * Detect standalone reassignment commands.
     * Returns a parsed array or null if the message is NOT a reassign command.
     *
     * Distinguishes from create_task+assignee by requiring no date in the message
     * AND the message to be structurally a reassign-only command.
     */
    private function detectReassignIntent(string $text): ?array {
        $trimmed = trim($text);

        // Pattern A: explicit task reference
        // "assign task PAY TAX to Nguyen"  /  "reassign "Meeting" to Liem"
        if (preg_match(self::REASSIGN_EXPLICIT_PATTERN, $trimmed, $m)) {
            $titleHint    = trim($m[1], " \t\"'");
            $assigneeName = trim($m[2]);
            // Guard: if title hint looks like it has a date, fall through to create_task
            if (!$this->extractDate($titleHint)) {
                return array_merge($this->result('update_task_assignee', $text), [
                    'task_ref'        => 'explicit',
                    'task_title_hint' => $titleHint,
                    'assignee_name'   => $assigneeName,
                ]);
            }
        }

        // Pattern B: standalone follow-up "assign to NAME" / "giao lại cho NAME"
        foreach (self::REASSIGN_STANDALONE as $pattern) {
            if (preg_match($pattern, $trimmed, $m)) {
                return array_merge($this->result('update_task_assignee', $text), [
                    'task_ref'        => 'last',
                    'task_title_hint' => null,
                    'assignee_name'   => trim($m[1]),
                ]);
            }
        }

        return null;
    }

    private function parseCommand(string $text, string $lower): array {
        if (preg_match('/^\/start\b/i', $text)) {
            return $this->result('start', $text);
        }
        if (preg_match('/^\/connect\s+([A-F0-9]{8})/i', $text, $m)) {
            return array_merge($this->result('connect', $text), ['code' => strtoupper($m[1])]);
        }
        if (preg_match('/^\/today\b/i', $text)) {
            return $this->result('today_cmd', $text);
        }
        if (preg_match('/^\/overdue\b/i', $text)) {
            return $this->result('overdue_cmd', $text);
        }
        if (preg_match('/^\/help\b/i', $text)) {
            return $this->result('help', $text);
        }
        return $this->result('unknown', $text);
    }

    private function isGreeting(string $lower): bool {
        // Direct match
        foreach (self::GREETING_WORDS as $word) {
            if ($lower === $word) return true;
            // "Hi [name]", "Hello there", etc.
            if (str_starts_with($lower, $word . ' ') || str_starts_with($lower, $word . ',')) return true;
        }
        // Common short greetings
        if (preg_match('/^(hi+|hey+|hello+|hiya|howdy|sup|what\'?s up)\b/i', $lower)) return true;
        return false;
    }

    private function isConnectHelp(string $lower): bool {
        foreach (self::CONNECT_TRIGGERS as $trigger) {
            if (str_contains($lower, $trigger)) return true;
        }
        // "liên kết" or "kết nối" anywhere with "telegram" or "dashboard"
        if ((str_contains($lower, 'liên kết') || str_contains($lower, 'kết nối'))
            && (str_contains($lower, 'telegram') || str_contains($lower, 'dashboard') || str_contains($lower, 'taskflow'))) {
            return true;
        }
        return false;
    }

    private function nextUpcomingDate(int $month, int $day): ?string {
        if ($month < 1 || $month > 12 || $day < 1 || $day > 31) return null;
        $today  = function_exists('app_today') ? app_today() : date('Y-m-d');
        $year   = (int)date('Y');
        $target = sprintf('%04d-%02d-%02d', $year, $month, $day);
        if ($target < $today) {
            $target = sprintf('%04d-%02d-%02d', $year + 1, $month, $day);
        }
        return $target;
    }

    /**
     * Next occurrence of a given weekday (0=Sun … 6=Sat).
     * $forceNext=true: always skip current week (e.g. "next Friday")
     * $forceNext=false: nearest upcoming including today (e.g. "this Friday")
     */
    private function nextWeekday(int $target, bool $forceNext): string {
        $today     = function_exists('app_today') ? app_today() : date('Y-m-d');
        $todayTs   = strtotime($today);
        $todayDow  = (int)date('w', $todayTs); // 0=Sun

        $diff = ($target - $todayDow + 7) % 7;

        if ($forceNext) {
            // "next Friday" — always at least 7 days away if today is Friday
            $diff = $diff === 0 ? 7 : $diff;
        } else {
            // "this Friday" / "on Friday" — use next occurrence ≥ today
            if ($diff === 0) $diff = 0; // today itself
        }

        return date('Y-m-d', strtotime($today . ' +' . $diff . ' days'));
    }

    private function containsAny(string $haystack, array $needles): bool {
        foreach ($needles as $needle) {
            if (str_contains($haystack, $needle)) return true;
        }
        return false;
    }

    private function extractQueryTerms(string $lower): array {
        $terms = [];
        foreach ($this->financeKeywords() as $kw) {
            if (str_contains($lower, $kw)) $terms[] = $kw;
        }
        if (preg_match('/(?:when is|deadline for|due date for|when does)\s+(?:the\s+)?(.+?)(?:\?|$)/i', $lower, $m)) {
            $terms[] = trim($m[1]);
        }
        return array_values(array_unique($terms));
    }

    private function financeKeywords(): array {
        return defined('TELEGRAM_FINANCE_KEYWORDS')
            ? (array)TELEGRAM_FINANCE_KEYWORDS
            : ['tax', 'payment tax', 'filing', 'check register', 'vendor payment',
               'bill', 'invoice', 'payroll', 'sales tax', 'pg&e', 'pge', 'quickbooks', 'qb'];
    }

    private function result(string $intent, string $raw): array {
        return [
            'intent'        => $intent,
            'title'         => null,
            'due_date'      => null,
            'store_hint'    => null,
            'project_hint'  => 'General',
            'raw'           => $raw,
            'missing'       => [],
            'clarification' => null,
        ];
    }
}
