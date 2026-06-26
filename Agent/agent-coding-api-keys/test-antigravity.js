#!/usr/bin/env node
/**
 * Quick connection test for Antigravity NKQ
 * Usage: ANTIGRAVITY_API_KEY=AGOP-xxxx-xxxx-xxxx node test-antigravity.js
 *    or: node test-antigravity.js  (reads from ../keys.json or ../.env)
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const DIR = path.dirname(fileURLToPath(import.meta.url))

function loadKey() {
  if (process.env.ANTIGRAVITY_API_KEY) return process.env.ANTIGRAVITY_API_KEY

  const keysFile = path.join(DIR, 'keys.json')
  if (existsSync(keysFile)) {
    const d = JSON.parse(readFileSync(keysFile, 'utf8'))
    const p = d.providers?.antigravity
    const activeKey = p?.keys?.find(k => k.active) || p?.keys?.[0]
    if (activeKey?.value) return activeKey.value
  }

  const envFile = path.join(DIR, '../.env')
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8').split('\n')
      .find(l => l.startsWith('ANTIGRAVITY_API_KEY='))
    if (line) {
      const val = line.split('=').slice(1).join('=').trim()
      if (val) return val
    }
  }

  return null
}

const BASE_URL = 'https://api.nkq.vn/v1'
const MODEL    = 'claude-opus-4-6'
const apiKey   = loadKey()

console.log('\n🔍 Antigravity NKQ Connection Test')
console.log('────────────────────────────────────')
console.log(`  URL  : ${BASE_URL}`)
console.log(`  Model: ${MODEL}`)

if (!apiKey) {
  console.error('\n❌  No API key found.')
  console.error('   Set ANTIGRAVITY_API_KEY=AGOP-XXXX-XXXX-XXXX in keys.json or .env\n')
  process.exit(1)
}

const masked = apiKey.slice(0, 9) + '••••' + apiKey.slice(-4)
console.log(`  Key  : ${masked}`)
console.log('\n⏳  Sending test request...\n')

try {
  const res = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }]
    }),
    signal: AbortSignal.timeout(15000)
  })

  const data = await res.json()

  if (!res.ok) {
    console.error(`❌  HTTP ${res.status}: ${data.error?.message || JSON.stringify(data)}`)
    process.exit(1)
  }

  const reply = data.content?.find(c => c.type === 'text')?.text || '(empty)'
  console.log(`✅  Connected! Model replied: "${reply}"`)
  console.log(`    Input tokens : ${data.usage?.input_tokens ?? 'n/a'}`)
  console.log(`    Output tokens: ${data.usage?.output_tokens ?? 'n/a'}`)
  console.log(`    Stop reason  : ${data.stop_reason ?? 'n/a'}`)
  console.log()
} catch (err) {
  if (err.name === 'TimeoutError') {
    console.error('❌  Request timed out (15s). Check your network or the endpoint.')
  } else {
    console.error(`❌  ${err.message}`)
  }
  process.exit(1)
}
