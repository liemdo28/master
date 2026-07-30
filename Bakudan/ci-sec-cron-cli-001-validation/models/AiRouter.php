<?php
/**
 * AiRouter — Multi-provider AI abstraction
 *
 * Priority order: Claude → OpenAI → Gemini (configurable via AI_PROVIDER_ORDER)
 * Health state is cached in DB (ai_provider_health table, created on demand).
 * On runtime failure the router falls back to the next healthy provider.
 *
 * Usage:
 *   $router = new AiRouter();
 *   $result = $router->chat([
 *       ['role' => 'user', 'content' => 'Hello'],
 *   ], [
 *       'system'   => 'You are a helpful assistant.',
 *       'tools'    => [...],   // optional, Claude/OpenAI tool format
 *       'max_tokens' => 1024,
 *   ]);
 *   // $result = ['content' => '...', 'provider' => 'claude', 'tokens' => 123]
 */
class AiRouter {
    private Database $db;
    private array $providerOrder;

    public function __construct() {
        $this->db            = Database::getInstance();
        $this->providerOrder = $this->parseOrder();
        $this->ensureHealthTable();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Send a chat completion request, auto-falling back on failure.
     *
     * @param  array  $messages  [{role,content}, ...]
     * @param  array  $options   system, tools, max_tokens, temperature
     * @return array{content:string, provider:string, tokens:int, tool_calls:array}
     * @throws RuntimeException  if all providers fail
     */
    public function chat(array $messages, array $options = []): array {
        $errors = [];
        foreach ($this->providerOrder as $provider) {
            if (!$this->isHealthy($provider)) continue;
            try {
                $result = $this->callProvider($provider, $messages, $options);
                $this->markHealthy($provider);
                return $result;
            } catch (\Throwable $e) {
                $errors[$provider] = $e->getMessage();
                $this->markUnhealthy($provider);
                error_log("AiRouter [{$provider}] failed: " . $e->getMessage());
            }
        }
        throw new \RuntimeException('All AI providers unavailable: ' . json_encode($errors));
    }

    /**
     * Run a health check pass for all providers and update DB cache.
     * Called by cron every 5 minutes.
     */
    public function runHealthCheck(): array {
        $results = [];
        foreach ($this->providerOrder as $provider) {
            try {
                $this->callProvider($provider, [
                    ['role' => 'user', 'content' => 'ping']
                ], ['max_tokens' => 5]);
                $this->markHealthy($provider);
                $results[$provider] = 'ok';
            } catch (\Throwable $e) {
                $this->markUnhealthy($provider);
                $results[$provider] = 'fail: ' . $e->getMessage();
            }
        }
        return $results;
    }

    // ── Provider dispatch ─────────────────────────────────────────────────────

    private function callProvider(string $provider, array $messages, array $options): array {
        return match ($provider) {
            'claude' => $this->callClaude($messages, $options),
            'openai' => $this->callOpenAi($messages, $options),
            'gemini' => $this->callGemini($messages, $options),
            default  => throw new \InvalidArgumentException("Unknown provider: {$provider}"),
        };
    }

    // ── Claude (Anthropic) ────────────────────────────────────────────────────

    private function callClaude(array $messages, array $options): array {
        $key = defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : '';
        if ($key === '') throw new \RuntimeException('ANTHROPIC_API_KEY not configured');

        $model     = defined('TG_CLAUDE_MODEL') ? TG_CLAUDE_MODEL : 'claude-haiku-4-5-20251001';
        $maxTokens = (int)($options['max_tokens'] ?? 1024);
        $system    = $options['system'] ?? '';

        $body = [
            'model'      => $model,
            'max_tokens' => $maxTokens,
            'messages'   => $messages,
        ];
        if ($system !== '')             $body['system'] = $system;
        if (!empty($options['tools']))  $body['tools']  = $options['tools'];

        $response = $this->httpPost('https://api.anthropic.com/v1/messages', $body, [
            'x-api-key'         => $key,
            'anthropic-version' => '2023-06-01',
        ]);

        // Parse response
        $text       = '';
        $toolCalls  = [];
        $inputTok   = (int)($response['usage']['input_tokens']  ?? 0);
        $outputTok  = (int)($response['usage']['output_tokens'] ?? 0);

        foreach ($response['content'] ?? [] as $block) {
            if ($block['type'] === 'text')     $text      .= $block['text'];
            if ($block['type'] === 'tool_use') $toolCalls[] = $block;
        }

        return [
            'content'    => $text,
            'provider'   => 'claude',
            'tokens'     => $inputTok + $outputTok,
            'tool_calls' => $toolCalls,
            'stop_reason'=> $response['stop_reason'] ?? null,
        ];
    }

    // ── OpenAI ────────────────────────────────────────────────────────────────

    private function callOpenAi(array $messages, array $options): array {
        $key = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : openai_api_key();
        if ($key === '') throw new \RuntimeException('OPENAI_API_KEY not configured');

        $model     = defined('TG_OPENAI_MODEL') ? TG_OPENAI_MODEL : 'gpt-4o-mini';
        $maxTokens = (int)($options['max_tokens'] ?? 1024);
        $system    = $options['system'] ?? '';

        $msgs = $messages;
        if ($system !== '') {
            array_unshift($msgs, ['role' => 'system', 'content' => $system]);
        }

        $body = ['model' => $model, 'max_tokens' => $maxTokens, 'messages' => $msgs];

        // Convert Claude-style tool definitions to OpenAI format
        if (!empty($options['tools'])) {
            $body['tools'] = array_map(fn($t) => [
                'type'     => 'function',
                'function' => [
                    'name'        => $t['name'],
                    'description' => $t['description'] ?? '',
                    'parameters'  => $t['input_schema'] ?? (object)[],
                ],
            ], $options['tools']);
            $body['tool_choice'] = 'auto';
        }

        $response = $this->httpPost(
            (defined('OPENAI_BASE_URL') ? OPENAI_BASE_URL : 'https://api.openai.com/v1') . '/chat/completions',
            $body,
            ['Authorization' => 'Bearer ' . $key]
        );

        $choice    = $response['choices'][0] ?? [];
        $msg       = $choice['message'] ?? [];
        $text      = $msg['content'] ?? '';
        $toolCalls = [];

        // Normalize OpenAI tool calls to Claude format
        foreach ($msg['tool_calls'] ?? [] as $tc) {
            $toolCalls[] = [
                'type'  => 'tool_use',
                'id'    => $tc['id'],
                'name'  => $tc['function']['name'],
                'input' => json_decode($tc['function']['arguments'] ?? '{}', true) ?? [],
            ];
        }

        $usage = $response['usage'] ?? [];
        return [
            'content'     => $text ?? '',
            'provider'    => 'openai',
            'tokens'      => (int)(($usage['total_tokens'] ?? 0)),
            'tool_calls'  => $toolCalls,
            'stop_reason' => $choice['finish_reason'] ?? null,
        ];
    }

    // ── Gemini ────────────────────────────────────────────────────────────────

    private function callGemini(array $messages, array $options): array {
        $key = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
        if ($key === '') throw new \RuntimeException('GEMINI_API_KEY not configured');

        $model   = defined('TG_GEMINI_MODEL') ? TG_GEMINI_MODEL : 'gemini-1.5-flash';
        $system  = $options['system'] ?? '';

        // Convert messages to Gemini's contents format
        $contents = [];
        foreach ($messages as $m) {
            $role = $m['role'] === 'assistant' ? 'model' : 'user';
            $contents[] = ['role' => $role, 'parts' => [['text' => $m['content']]]];
        }

        $body = ['contents' => $contents];
        if ($system !== '') {
            $body['systemInstruction'] = ['parts' => [['text' => $system]]];
        }
        if (!empty($options['max_tokens'])) {
            $body['generationConfig'] = ['maxOutputTokens' => (int)$options['max_tokens']];
        }

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}";
        $response = $this->httpPost($url, $body, []);

        $text = '';
        foreach ($response['candidates'][0]['content']['parts'] ?? [] as $part) {
            $text .= $part['text'] ?? '';
        }

        $usage = $response['usageMetadata'] ?? [];
        return [
            'content'    => $text,
            'provider'   => 'gemini',
            'tokens'     => (int)(($usage['totalTokenCount'] ?? 0)),
            'tool_calls' => [],
            'stop_reason'=> $response['candidates'][0]['finishReason'] ?? null,
        ];
    }

    // ── HTTP helper ───────────────────────────────────────────────────────────

    private function httpPost(string $url, array $body, array $extraHeaders): array {
        $json    = json_encode($body, JSON_UNESCAPED_UNICODE);
        $headers = array_merge([
            'Content-Type'  => 'application/json',
            'Content-Length'=> strlen($json),
        ], $extraHeaders);

        $headerLines = array_map(
            fn($k, $v) => "{$k}: {$v}",
            array_keys($headers),
            array_values($headers)
        );

        $context = stream_context_create(['http' => [
            'method'        => 'POST',
            'header'        => implode("\r\n", $headerLines),
            'content'       => $json,
            'timeout'        => 30,
            'ignore_errors' => true,
        ]]);

        $raw = @file_get_contents($url, false, $context);
        if ($raw === false) {
            throw new \RuntimeException("HTTP request failed to {$url}");
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new \RuntimeException("Invalid JSON response from {$url}: " . substr($raw, 0, 200));
        }
        if (isset($data['error'])) {
            $msg = is_array($data['error']) ? ($data['error']['message'] ?? json_encode($data['error'])) : $data['error'];
            throw new \RuntimeException("API error: {$msg}");
        }

        return $data;
    }

    // ── Health check helpers ──────────────────────────────────────────────────

    private function ensureHealthTable(): void {
        if (!$this->db->tableExists('ai_provider_health')) {
            try {
                $this->db->execute("
                    CREATE TABLE IF NOT EXISTS ai_provider_health (
                        provider     VARCHAR(20)  NOT NULL PRIMARY KEY,
                        is_healthy   TINYINT(1)   NOT NULL DEFAULT 1,
                        last_checked TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        fail_reason  VARCHAR(500) NULL DEFAULT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                // Seed rows
                foreach ($this->providerOrder as $p) {
                    $this->db->execute(
                        "INSERT IGNORE INTO ai_provider_health (provider, is_healthy) VALUES (?, 1)",
                        [$p]
                    );
                }
            } catch (\Exception $e) { /* non-fatal */ }
        }
    }

    private function isHealthy(string $provider): bool {
        $row = $this->db->fetch(
            "SELECT is_healthy, last_checked FROM ai_provider_health WHERE provider = ?",
            [$provider]
        );
        if (!$row) return true; // unknown → assume healthy

        // Re-attempt after 5 minutes even if previously unhealthy
        $lastChecked = strtotime($row['last_checked'] ?? 'now');
        if (!(bool)(int)$row['is_healthy'] && (time() - $lastChecked) < 300) {
            return false;
        }
        return true;
    }

    private function markHealthy(string $provider): void {
        $this->db->execute(
            "INSERT INTO ai_provider_health (provider, is_healthy, last_checked, fail_reason)
             VALUES (?, 1, NOW(), NULL)
             ON DUPLICATE KEY UPDATE is_healthy=1, last_checked=NOW(), fail_reason=NULL",
            [$provider]
        );
    }

    private function markUnhealthy(string $provider, string $reason = ''): void {
        $this->db->execute(
            "INSERT INTO ai_provider_health (provider, is_healthy, last_checked, fail_reason)
             VALUES (?, 0, NOW(), ?)
             ON DUPLICATE KEY UPDATE is_healthy=0, last_checked=NOW(), fail_reason=?",
            [$provider, $reason, $reason]
        );
    }

    private function parseOrder(): array {
        $raw = defined('AI_PROVIDER_ORDER') ? AI_PROVIDER_ORDER : 'claude,openai,gemini';
        return array_filter(array_map('trim', explode(',', $raw)));
    }
}
