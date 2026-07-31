import assert from 'assert';
import { listProviders, routeToProvider } from '../provider-router';
import type { ProviderRequest } from '../provider-router';

const credentialKeys = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'XAI_API_KEY',
] as const;

const savedEnv = new Map<string, string | undefined>();

for (const key of credentialKeys) {
  savedEnv.set(key, process.env[key]);
  delete process.env[key];
}

async function run() {
  const providers = listProviders();
  assert.deepStrictEqual(
    providers.map(p => p.provider),
    ['openai', 'anthropic', 'gemini', 'deepseek', 'xai'],
  );
  assert.ok(providers.find(p => p.provider === 'xai')?.models.includes('grok-2'));
  assert.ok(providers.every(p => p.configured === false));

  const defaultTier = await routeToProvider({ tier: 'ceo-brain', prompt: 'hello' });
  assert.strictEqual(defaultTier.provider, 'anthropic');
  assert.strictEqual(defaultTier.model, 'claude-sonnet-4-6');
  assert.strictEqual(defaultTier.error, 'ANTHROPIC_API_KEY not set');

  const openai = await routeToProvider({ tier: 'coding', model: 'gpt-4o', prompt: 'hello' });
  assert.strictEqual(openai.provider, 'openai');
  assert.strictEqual(openai.error, 'OPENAI_API_KEY not set');

  const deepseek = await routeToProvider({ tier: 'coding', model: 'deepseek-coder', prompt: 'hello' });
  assert.strictEqual(deepseek.provider, 'deepseek');
  assert.strictEqual(deepseek.error, 'DEEPSEEK_API_KEY not set');

  const xai = await routeToProvider({ tier: 'coding', model: 'grok-2', prompt: 'hello' });
  assert.strictEqual(xai.provider, 'xai');
  assert.strictEqual(xai.error, 'XAI_API_KEY not set');

  const visionRequest: ProviderRequest = {
    tier: 'vision',
    prompt: 'describe',
    image_b64: Buffer.from('fake-image').toString('base64'),
    temperature: 0,
  };
  const vision = await routeToProvider(visionRequest);
  assert.strictEqual(vision.provider, 'gemini');
  assert.strictEqual(vision.model, 'gemini-2.0-flash');
  assert.strictEqual(vision.error, 'GEMINI_API_KEY not set');
}

run()
  .then(() => {
    console.log('[provider-router] PASS');
  })
  .catch(err => {
    console.error('[provider-router] FAIL:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const [key, value] of savedEnv.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
