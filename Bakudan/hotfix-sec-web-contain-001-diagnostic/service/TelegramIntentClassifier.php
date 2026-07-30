<?php
/**
 * TelegramIntentClassifier — two-layer intent classification.
 *
 * Layer 1 (always): Rule-based hard commands (/start, /today, /connect …)
 *                   They're fast, unambiguous — never sent to AI.
 *
 * Layer 2a (OpenAI): Natural language → GPT-4o-mini with structured JSON output
 *                    Resolves relative dates, mixed-language, casual phrasing.
 *
 * Layer 2b (fallback): Enhanced rule-based if AI not configured or API fails.
 *
 * Returns the same array shape as TelegramTaskParserService::parse() plus
 * an optional 'clarification' key used by the fallback handler.
 */
class TelegramIntentClassifier {
    private TelegramTaskParserService $rules;

    public function __construct() {
        $this->rules = new TelegramTaskParserService();
    }

    /**
     * Classify a raw Telegram message.
     *
     * @param string $text    Raw message text
     * @param array  $context ['stores'=>[[name=>...]], 'users'=>[[name=>...]], 'today'=>'YYYY-MM-DD']
     */
    public function classify(string $text, array $context = []): array {
        $text = trim($text);

        // ── Hard slash commands: always rule-based (fast + reliable) ─────────
        if ($text !== '' && $text[0] === '/') {
            return $this->rules->parse($text);
        }

        // ── Natural language: try AI first ────────────────────────────────────
        if (openai_is_configured()) {
            try {
                return $this->classifyWithAI($text, $context);
            } catch (\Throwable $e) {
                error_log('[TelegramIntentClassifier] AI failed, falling back: ' . $e->getMessage());
            }
        }

        // ── Fallback: enhanced rule-based ──────────────────────────────────────
        return $this->rules->parse($text);
    }

    // ── AI classification ──────────────────────────────────────────────────────

    private function classifyWithAI(string $text, array $context): array {
        $today      = $context['today'] ?? (function_exists('app_today') ? app_today() : date('Y-m-d'));
        $dayOfWeek  = date('l', strtotime($today)); // e.g. "Sunday"
        $storeList  = implode(', ', array_column($context['stores'] ?? [], 'name')) ?: 'none';
        $userList   = implode(', ', array_column($context['users'] ?? [], 'name'))  ?: 'none';

        $system = <<<PROMPT
You are the intent classifier for TaskFlow, a task management app.

Today: {$today} ({$dayOfWeek})
Known stores: {$storeList}
Known users: {$userList}

Classify the user message into exactly ONE intent:
- greeting            : saying hi, hello, hey, good morning, xin chào, chào, etc.
- create_task         : creating, adding, scheduling, reminding about a task
- query_task          : asking about deadlines, due dates, status of existing tasks
- today_tasks         : asking about tasks due today (hôm nay, what do I have today)
- overdue_tasks       : asking about overdue or late tasks (quá hạn, late tasks)
- update_task_assignee: reassigning / assigning a task to another person.
                        Use this when the message is ONLY about assignment (no new task creation).
                        Examples: "Assign to Nguyen", "Reassign this to Liem", "Giao lại cho Nguyen",
                        "Assign task Pay tax to Nguyen", "Chuyển cho Hoang"
- connect_help        : asking how to connect/link Telegram to the dashboard account
- help                : asking for list of commands or how the bot works
- unknown             : cannot be classified into any of the above

Also extract these entities (all optional, omit if not present):
- title               : clean task title stripped of date, store, assignee phrases (for create_task)
- due_date            : resolved to YYYY-MM-DD. Resolve relative dates (tomorrow = {$today} + 1 day, next Friday = nearest upcoming Friday, in 3 days, etc.)
- store_hint          : name matched from Known stores list (or partial match)
- project_hint        : "Finance" if the message is about tax, payment, bill, invoice, payroll, QB, PG&E; otherwise "General"
- assignee_hint       : raw name string if create_task and user wants to assign to someone
- task_ref            : for update_task_assignee only — "last" if referring to previous task, "explicit" if task title is mentioned
- task_title_hint     : for update_task_assignee + task_ref=explicit — the task title being referenced
- assignee_name       : for update_task_assignee — the target person's name
- clarification       : if intent is ambiguous or entities are missing, write a SHORT clarifying question (one sentence max)

Return valid JSON only. No markdown. No explanation. Examples:
{"intent":"create_task","title":"Pay sales tax","due_date":"2025-04-23","store_hint":"Raw Stockton","project_hint":"Finance","assignee_hint":null,"clarification":null}
{"intent":"update_task_assignee","task_ref":"last","task_title_hint":null,"assignee_name":"Nguyen","clarification":null}
{"intent":"update_task_assignee","task_ref":"explicit","task_title_hint":"Pay tax for Raw","assignee_name":"Liem","clarification":null}
PROMPT;

        $payload = [
            'model'           => openai_task_model(),
            'temperature'     => 0,
            'response_format' => ['type' => 'json_object'],
            'max_tokens'      => 300,
            'messages'        => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user',   'content' => $text],
            ],
        ];

        $response = $this->callChatCompletions($payload);
        $content  = $response['choices'][0]['message']['content'] ?? '{}';
        $parsed   = json_decode($content, true);

        if (!is_array($parsed) || empty($parsed['intent'])) {
            throw new \RuntimeException('Invalid JSON from AI: ' . $content);
        }

        return $this->normalizeAIResult($parsed, $text);
    }

    /**
     * Normalize the AI result into the same shape as TelegramTaskParserService::parse().
     */
    private function normalizeAIResult(array $ai, string $raw): array {
        $validIntents = [
            'greeting', 'create_task', 'query_task', 'today_tasks',
            'overdue_tasks', 'update_task_assignee', 'connect_help', 'help', 'unknown',
        ];

        $intent = in_array($ai['intent'], $validIntents, true) ? $ai['intent'] : 'unknown';

        $result = [
            'intent'          => $intent,
            'title'           => $ai['title']           ?? null,
            'due_date'        => $this->sanitizeDate($ai['due_date'] ?? null),
            'store_hint'      => $ai['store_hint']      ?? null,
            'project_hint'    => $ai['project_hint']    ?? 'General',
            'assignee_hint'   => $ai['assignee_hint']   ?? null,
            // update_task_assignee fields
            'task_ref'        => $ai['task_ref']        ?? null,
            'task_title_hint' => $ai['task_title_hint'] ?? null,
            'assignee_name'   => $ai['assignee_name']   ?? null,
            'raw'             => $raw,
            'missing'         => [],
            'clarification'   => $ai['clarification']   ?? null,
            'ai_classified'   => true,
        ];

        // Populate missing fields for create_task
        if ($intent === 'create_task') {
            if (!$result['title'])    $result['missing'][] = 'title';
            if (!$result['due_date']) $result['missing'][] = 'due_date';
        }

        // For query_task, build query_terms from title
        if ($intent === 'query_task') {
            $result['query_terms'] = array_filter([
                $result['title'],
                $result['store_hint'],
            ]);
        }

        return $result;
    }

    // ── HTTP helper ────────────────────────────────────────────────────────────

    private function callChatCompletions(array $payload): array {
        $url     = rtrim(openai_base_url(), '/') . '/chat/completions';
        $apiKey  = openai_api_key();
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ];
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_HTTPHEADER     => $headers,
                CURLOPT_POSTFIELDS     => $body,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 15, // Telegram needs fast responses
                CURLOPT_SSL_VERIFYPEER => true,
            ]);
            $raw      = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlErr  = curl_error($ch);
            curl_close($ch);

            if ($raw === false) {
                throw new \RuntimeException('cURL error: ' . $curlErr);
            }
        } else {
            $ctx = stream_context_create([
                'http' => [
                    'method'        => 'POST',
                    'header'        => implode("\r\n", $headers),
                    'content'       => $body,
                    'timeout'       => 15,
                    'ignore_errors' => true,
                ],
            ]);
            $raw      = @file_get_contents($url, false, $ctx);
            $httpCode = 0;
            if ($raw === false) throw new \RuntimeException('stream_socket request failed.');
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('Invalid JSON from OpenAI: ' . substr((string)$raw, 0, 200));
        }
        if ($httpCode >= 400) {
            $msg = $decoded['error']['message'] ?? "OpenAI API error ({$httpCode})";
            throw new \RuntimeException($msg);
        }

        return $decoded;
    }

    private function sanitizeDate(?string $date): ?string {
        if (!$date) return null;
        // Accept only YYYY-MM-DD
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m)) {
            [$_, $y, $mon, $d] = $m;
            if (checkdate((int)$mon, (int)$d, (int)$y)) return $date;
        }
        return null;
    }
}
