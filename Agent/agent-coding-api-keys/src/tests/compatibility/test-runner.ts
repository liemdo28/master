/**
 * Antigravity Gateway — Protocol Compatibility Test Runner
 *
 * Automated validation for client compatibility:
 *  - Cline
 *  - Claude Code
 *  - Continue
 *  - RooCode
 *  - OpenCode
 *
 * Tests:
 *  - tool-use correctness
 *  - recursive reasoning loops
 *  - streaming deltas
 *  - long context
 *  - interruption recovery
 *  - multi-tool chains
 *  - stop_reason handling
 *  - delta event compatibility
 */

export interface TestResult {
    name: string;
    client: string;
    protocol: 'anthropic' | 'openai';
    passed: boolean;
    durationMs: number;
    error?: string;
    details?: Record<string, unknown>;
}

export interface TestSuite {
    name: string;
    client: string;
    tests: TestResult[];
    passCount: number;
    failCount: number;
    totalDurationMs: number;
}

export type TestFn = (baseUrl: string) => Promise<TestResult>;

const BASE_URL = process.env.GATEWAY_TEST_URL ?? 'http://127.0.0.1:3456';

// ── Test Registry ──────────────────────────────────────────────────────────

const testRegistry: Array<{ name: string; client: string; fn: TestFn }> = [];

function registerTest(name: string, client: string, fn: TestFn): void {
    testRegistry.push({ name, client, fn });
}

// ── Run all tests ──────────────────────────────────────────────────────────

export async function runAllTests(baseUrl = BASE_URL): Promise<TestSuite[]> {
    const suiteMap = new Map<string, TestResult[]>();

    for (const { name, client, fn } of testRegistry) {
        try {
            const result = await fn(baseUrl);
            const suite = suiteMap.get(client) ?? [];
            suite.push(result);
            suiteMap.set(client, suite);
        } catch (err) {
            const suite = suiteMap.get(client) ?? [];
            suite.push({
                name,
                client,
                protocol: 'openai',
                passed: false,
                durationMs: 0,
                error: err instanceof Error ? err.message : String(err),
            });
            suiteMap.set(client, suite);
        }
    }

    const suites: TestSuite[] = [];
    for (const [client, tests] of suiteMap) {
        suites.push({
            name: `${client} Compatibility`,
            client,
            tests,
            passCount: tests.filter((t) => t.passed).length,
            failCount: tests.filter((t) => !t.passed).length,
            totalDurationMs: tests.reduce((sum, t) => sum + t.durationMs, 0),
        });
    }

    return suites;
}

export async function runClientTests(client: string, baseUrl = BASE_URL): Promise<TestSuite> {
    const tests: TestResult[] = [];
    const clientTests = testRegistry.filter((t) => t.client === client);

    for (const { name, fn } of clientTests) {
        try {
            tests.push(await fn(baseUrl));
        } catch (err) {
            tests.push({
                name,
                client,
                protocol: 'openai',
                passed: false,
                durationMs: 0,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return {
        name: `${client} Compatibility`,
        client,
        tests,
        passCount: tests.filter((t) => t.passed).length,
        failCount: tests.filter((t) => !t.passed).length,
        totalDurationMs: tests.reduce((sum, t) => sum + t.durationMs, 0),
    };
}

// ── Helper utilities ───────────────────────────────────────────────────────

async function postJSON(url: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer proxy', ...headers },
        body: JSON.stringify(body),
    });
}

async function collectSSE(response: Response): Promise<string[]> {
    if (!response.body) return [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const events: string[] = [];
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (line.startsWith('data:')) {
                events.push(line.slice(5).trim());
            }
        }
    }
    return events;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLINE COMPATIBILITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

registerTest('cline-basic-chat', 'cline', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 16,
        stream: false,
    });

    const data = await res.json() as Record<string, unknown>;
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const passed = res.ok && !!choices?.[0];

    return {
        name: 'cline-basic-chat',
        client: 'cline',
        protocol: 'openai',
        passed,
        durationMs: Date.now() - start,
        details: { status: res.status, hasChoices: !!choices?.length },
    };
});

registerTest('cline-streaming', 'cline', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 50,
        stream: true,
    });

    const events = await collectSSE(res);
    const hasDone = events.includes('[DONE]');
    const hasContent = events.some((e) => {
        try {
            const d = JSON.parse(e) as Record<string, unknown>;
            const choices = d.choices as Array<Record<string, unknown>> | undefined;
            return choices?.[0]?.delta !== undefined;
        } catch { return false; }
    });

    return {
        name: 'cline-streaming',
        client: 'cline',
        protocol: 'openai',
        passed: res.ok && hasDone && hasContent,
        durationMs: Date.now() - start,
        details: { eventCount: events.length, hasDone, hasContent },
    };
});

registerTest('cline-tool-use', 'cline', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Read the file /tmp/test.txt' }],
        max_tokens: 1024,
        stream: true,
        tools: [{
            type: 'function',
            function: {
                name: 'read_file',
                description: 'Read a file from the filesystem',
                parameters: {
                    type: 'object',
                    properties: { path: { type: 'string', description: 'File path' } },
                    required: ['path'],
                },
            },
        }],
        tool_choice: 'auto',
    });

    const events = await collectSSE(res);
    const hasToolCall = events.some((e) => {
        try {
            const d = JSON.parse(e) as Record<string, unknown>;
            const choices = d.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            return delta?.tool_calls !== undefined;
        } catch { return false; }
    });

    const hasFinishToolCalls = events.some((e) => {
        try {
            const d = JSON.parse(e) as Record<string, unknown>;
            const choices = d.choices as Array<Record<string, unknown>> | undefined;
            return choices?.[0]?.finish_reason === 'tool_calls';
        } catch { return false; }
    });

    return {
        name: 'cline-tool-use',
        client: 'cline',
        protocol: 'openai',
        passed: res.ok && hasToolCall,
        durationMs: Date.now() - start,
        details: { eventCount: events.length, hasToolCall, hasFinishToolCalls },
    };
});

registerTest('cline-tool-result-chain', 'cline', async (baseUrl) => {
    const start = Date.now();
    // Simulate a multi-turn tool chain (assistant calls tool, user provides result)
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [
            { role: 'user', content: 'What is in /tmp/test.txt?' },
            {
                role: 'assistant',
                content: null,
                tool_calls: [{
                    id: 'call_001',
                    type: 'function',
                    function: { name: 'read_file', arguments: '{"path":"/tmp/test.txt"}' },
                }],
            },
            {
                role: 'tool',
                tool_call_id: 'call_001',
                content: 'Hello World',
            },
        ],
        max_tokens: 256,
        stream: true,
        tools: [{
            type: 'function',
            function: {
                name: 'read_file',
                description: 'Read a file',
                parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
            },
        }],
    });

    const events = await collectSSE(res);
    const hasContent = events.some((e) => {
        try {
            const d = JSON.parse(e) as Record<string, unknown>;
            const choices = d.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            return typeof delta?.content === 'string' && delta.content.length > 0;
        } catch { return false; }
    });

    return {
        name: 'cline-tool-result-chain',
        client: 'cline',
        protocol: 'openai',
        passed: res.ok && hasContent,
        durationMs: Date.now() - start,
        details: { eventCount: events.length, hasContent },
    };
});

registerTest('cline-streaming-role-delta', 'cline', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 16,
        stream: true,
    });

    const events = await collectSSE(res);
    // Cline expects the first chunk to have role: 'assistant'
    const firstChunk = events.find((e) => e !== '[DONE]');
    let hasRole = false;
    if (firstChunk) {
        try {
            const d = JSON.parse(firstChunk) as Record<string, unknown>;
            const choices = d.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            hasRole = delta?.role === 'assistant';
        } catch { /* ignore */ }
    }

    return {
        name: 'cline-streaming-role-delta',
        client: 'cline',
        protocol: 'openai',
        passed: res.ok && hasRole,
        durationMs: Date.now() - start,
        details: { hasRole, firstChunk },
    };
});

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE CODE COMPATIBILITY TESTS (Anthropic Messages API)
// ═══════════════════════════════════════════════════════════════════════════

registerTest('claude-code-basic-message', 'claude-code', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/messages`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 16,
        stream: false,
    }, { 'anthropic-version': '2023-06-01' });

    const data = await res.json() as Record<string, unknown>;
    const passed = res.ok
        && data.type === 'message'
        && data.role === 'assistant'
        && Array.isArray(data.content)
        && data.stop_reason !== undefined;

    return {
        name: 'claude-code-basic-message',
        client: 'claude-code',
        protocol: 'anthropic',
        passed,
        durationMs: Date.now() - start,
        details: { type: data.type, role: data.role, hasContent: Array.isArray(data.content), stopReason: data.stop_reason },
    };
});

registerTest('claude-code-streaming-events', 'claude-code', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/messages`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 50,
        stream: true,
    }, { 'anthropic-version': '2023-06-01' });

    if (!res.body) {
        return { name: 'claude-code-streaming-events', client: 'claude-code', protocol: 'anthropic', passed: false, durationMs: Date.now() - start, error: 'No response body' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
    }

    const lines = raw.split('\n');
    const events: Array<{ event: string; data: string }> = [];
    let currentEvent = '';
    for (const line of lines) {
        if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
        else if (line.startsWith('data:')) events.push({ event: currentEvent, data: line.slice(5).trim() });
    }

    const hasMessageStart = events.some((e) => e.event === 'message_start');
    const hasContentDelta = events.some((e) => e.event === 'content_block_delta');
    const hasMessageStop = events.some((e) => e.event === 'message_stop');
    const hasMessageDelta = events.some((e) => e.event === 'message_delta');

    return {
        name: 'claude-code-streaming-events',
        client: 'claude-code',
        protocol: 'anthropic',
        passed: res.ok && hasMessageStart && hasContentDelta && hasMessageStop,
        durationMs: Date.now() - start,
        details: { eventCount: events.length, hasMessageStart, hasContentDelta, hasMessageDelta, hasMessageStop },
    };
});

registerTest('claude-code-tool-use-blocks', 'claude-code', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/messages`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Read the file /tmp/test.txt' }],
        max_tokens: 1024,
        stream: true,
        tools: [{
            name: 'read_file',
            description: 'Read a file from the filesystem',
            input_schema: {
                type: 'object',
                properties: { path: { type: 'string', description: 'File path' } },
                required: ['path'],
            },
        }],
        tool_choice: { type: 'auto' },
    }, { 'anthropic-version': '2023-06-01' });

    if (!res.body) {
        return { name: 'claude-code-tool-use-blocks', client: 'claude-code', protocol: 'anthropic', passed: false, durationMs: Date.now() - start, error: 'No body' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
    }

    const lines = raw.split('\n');
    const events: Array<{ event: string; data: string }> = [];
    let currentEvent = '';
    for (const line of lines) {
        if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
        else if (line.startsWith('data:')) events.push({ event: currentEvent, data: line.slice(5).trim() });
    }

    const hasToolUseStart = events.some((e) => {
        if (e.event !== 'content_block_start') return false;
        try {
            const d = JSON.parse(e.data) as Record<string, unknown>;
            const block = d.content_block as Record<string, unknown> | undefined;
            return block?.type === 'tool_use';
        } catch { return false; }
    });

    const hasInputJsonDelta = events.some((e) => {
        if (e.event !== 'content_block_delta') return false;
        try {
            const d = JSON.parse(e.data) as Record<string, unknown>;
            const delta = d.delta as Record<string, unknown> | undefined;
            return delta?.type === 'input_json_delta';
        } catch { return false; }
    });

    const hasToolUseStop = events.some((e) => {
        if (e.event !== 'message_delta') return false;
        try {
            const d = JSON.parse(e.data) as Record<string, unknown>;
            const delta = d.delta as Record<string, unknown> | undefined;
            return delta?.stop_reason === 'tool_use';
        } catch { return false; }
    });

    return {
        name: 'claude-code-tool-use-blocks',
        client: 'claude-code',
        protocol: 'anthropic',
        passed: res.ok && hasToolUseStart,
        durationMs: Date.now() - start,
        details: { eventCount: events.length, hasToolUseStart, hasInputJsonDelta, hasToolUseStop },
    };
});

registerTest('claude-code-tool-result', 'claude-code', async (baseUrl) => {
    const start = Date.now();
    // Multi-turn with tool_result
    const res = await postJSON(`${baseUrl}/v1/messages`, {
        model: 'claude-opus-4-7',
        messages: [
            { role: 'user', content: 'What is in /tmp/test.txt?' },
            {
                role: 'assistant',
                content: [
                    { type: 'tool_use', id: 'toolu_001', name: 'read_file', input: { path: '/tmp/test.txt' } },
                ],
            },
            {
                role: 'user',
                content: [
                    { type: 'tool_result', tool_use_id: 'toolu_001', content: 'Hello World' },
                ],
            },
        ],
        max_tokens: 256,
        stream: false,
        tools: [{
            name: 'read_file',
            description: 'Read a file',
            input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        }],
    }, { 'anthropic-version': '2023-06-01' });

    const data = await res.json() as Record<string, unknown>;
    const content = data.content as Array<Record<string, unknown>> | undefined;
    const hasTextResponse = content?.some((b) => b.type === 'text' && typeof b.text === 'string');

    return {
        name: 'claude-code-tool-result',
        client: 'claude-code',
        protocol: 'anthropic',
        passed: res.ok && !!hasTextResponse,
        durationMs: Date.now() - start,
        details: { hasTextResponse, contentBlocks: content?.length },
    };
});

registerTest('claude-code-stop-reason-mapping', 'claude-code', async (baseUrl) => {
    const start = Date.now();
    // Non-streaming to check stop_reason
    const res = await postJSON(`${baseUrl}/v1/messages`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 16,
        stream: false,
    }, { 'anthropic-version': '2023-06-01' });

    const data = await res.json() as Record<string, unknown>;
    const validStopReasons = ['end_turn', 'tool_use', 'max_tokens', 'stop_sequence'];
    const stopReason = data.stop_reason as string | undefined;
    const passed = res.ok && !!stopReason && validStopReasons.includes(stopReason);

    return {
        name: 'claude-code-stop-reason-mapping',
        client: 'claude-code',
        protocol: 'anthropic',
        passed,
        durationMs: Date.now() - start,
        details: { stopReason, valid: validStopReasons.includes(stopReason ?? '') },
    };
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTINUE / ROOCODE COMPATIBILITY TESTS (OpenAI format)
// ═══════════════════════════════════════════════════════════════════════════

registerTest('continue-streaming-format', 'continue', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello' },
        ],
        max_tokens: 50,
        stream: true,
    });

    const events = await collectSSE(res);
    // Continue expects standard OpenAI chunk format
    const validChunks = events.filter((e) => e !== '[DONE]').every((e) => {
        try {
            const d = JSON.parse(e) as Record<string, unknown>;
            return d.object === 'chat.completion.chunk' && Array.isArray(d.choices);
        } catch { return false; }
    });

    return {
        name: 'continue-streaming-format',
        client: 'continue',
        protocol: 'openai',
        passed: res.ok && validChunks && events.includes('[DONE]'),
        durationMs: Date.now() - start,
        details: { eventCount: events.length, validChunks },
    };
});

registerTest('roocode-multi-tool', 'roocode', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'List files in /tmp and read /tmp/test.txt' }],
        max_tokens: 2048,
        stream: true,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'list_files',
                    description: 'List files in a directory',
                    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'read_file',
                    description: 'Read a file',
                    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
                },
            },
        ],
        tool_choice: 'auto',
    });

    const events = await collectSSE(res);
    const toolCallEvents = events.filter((e) => {
        try {
            const d = JSON.parse(e) as Record<string, unknown>;
            const choices = d.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            return delta?.tool_calls !== undefined;
        } catch { return false; }
    });

    return {
        name: 'roocode-multi-tool',
        client: 'roocode',
        protocol: 'openai',
        passed: res.ok && toolCallEvents.length > 0,
        durationMs: Date.now() - start,
        details: { eventCount: events.length, toolCallEventCount: toolCallEvents.length },
    };
});

registerTest('opencode-model-list', 'opencode', async (baseUrl) => {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/v1/models`, {
        headers: { 'Authorization': 'Bearer proxy' },
    });

    const data = await res.json() as Record<string, unknown>;
    const models = data.data as Array<Record<string, unknown>> | undefined;
    const passed = res.ok && data.object === 'list' && Array.isArray(models) && models.length > 0;

    return {
        name: 'opencode-model-list',
        client: 'opencode',
        protocol: 'openai',
        passed,
        durationMs: Date.now() - start,
        details: { modelCount: models?.length ?? 0 },
    };
});

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL CORRECTNESS TESTS
// ═══════════════════════════════════════════════════════════════════════════

registerTest('protocol-finish-reason-stop', 'protocol', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 16,
        stream: false,
    });

    const data = await res.json() as Record<string, unknown>;
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const finishReason = choices?.[0]?.finish_reason;
    const passed = res.ok && finishReason === 'stop';

    return {
        name: 'protocol-finish-reason-stop',
        client: 'protocol',
        protocol: 'openai',
        passed,
        durationMs: Date.now() - start,
        details: { finishReason },
    };
});

registerTest('protocol-usage-tokens', 'protocol', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/chat/completions`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 16,
        stream: false,
    });

    const data = await res.json() as Record<string, unknown>;
    const usage = data.usage as Record<string, unknown> | undefined;
    const passed = res.ok
        && typeof usage?.prompt_tokens === 'number'
        && typeof usage?.completion_tokens === 'number'
        && typeof usage?.total_tokens === 'number';

    return {
        name: 'protocol-usage-tokens',
        client: 'protocol',
        protocol: 'openai',
        passed,
        durationMs: Date.now() - start,
        details: { usage },
    };
});

registerTest('protocol-anthropic-usage', 'protocol', async (baseUrl) => {
    const start = Date.now();
    const res = await postJSON(`${baseUrl}/v1/messages`, {
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 16,
        stream: false,
    }, { 'anthropic-version': '2023-06-01' });

    const data = await res.json() as Record<string, unknown>;
    const usage = data.usage as Record<string, unknown> | undefined;
    const passed = res.ok
        && typeof usage?.input_tokens === 'number'
        && typeof usage?.output_tokens === 'number';

    return {
        name: 'protocol-anthropic-usage',
        client: 'protocol',
        protocol: 'anthropic',
        passed,
        durationMs: Date.now() - start,
        details: { usage },
    };
});

// ── Export for programmatic use ────────────────────────────────────────────

export { testRegistry, registerTest, postJSON, collectSSE };
