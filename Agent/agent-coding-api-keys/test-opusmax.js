#!/usr/bin/env node
/**
 * Quick connection test for OpusMax
 * Usage: OPUSMAX_API_KEY=sk_xxx node test-opusmax.js
 *    or: node test-opusmax.js  (reads from ../keys.json or ../.env)
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const DIR = path.dirname(fileURLToPath(import.meta.url))

function loadKey() {
  // 1. CLI env
  if (process.env.OPUSMAX_API_KEY) return process.env.OPUSMAX_API_KEY

  // 2. keys.json
  const keysFile = path.join(DIR, 'keys.json')
  if (existsSync(keysFile)) {
    const d = JSON.parse(readFileSync(keysFile, 'utf8'))
    const p = d.providers?.opusmax
    const activeKey = p?.keys?.find(k => k.active) || p?.keys?.[0]
    if (activeKey?.value) return activeKey.value
  }

  // 3. parent .env
  const envFile = path.join(DIR, '../.env')
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8').split('\n').find(l => l.startsWith('OPUSMAX_API_KEY='))
    if (line) {
      const val = line.split('=').slice(1).join('=').trim()
      if (val) return val
    }
  }

  return null
}

const BASE_URL = 'https://opusmax.shop/v1'
const MODEL    = 'claude-opus-4.7'
const apiKey   = loadKey()

console.log('\n🔍 OpusMax Connection Test')
console.log('──────────────────────────')
console.log(`  URL  : ${BASE_URL}`)
console.log(`  Model: ${MODEL}`)

if (!apiKey) {
  console.error('\n❌  No API key found.')
  console.error('   Set OPUSMAX_API_KEY=sk_... in keys.json or .env\n')
  process.exit(1)
}

const masked = apiKey.slice(0, 6) + '••••••' + apiKey.slice(-4)
console.log(`  Key  : ${masked}`)
console.log('\n⏳  Sending test request...\n')

try {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 10,
      temperature: 0,
      stream: false
    }),
    signal: AbortSignal.timeout(15000)
  })

  const data = await res.json()

  if (!res.ok) {
    console.error(`❌  HTTP ${res.status}: ${data.error?.message || JSON.stringify(data)}`)
    process.exit(1)
  }

  const reply = data.choices?.[0]?.message?.content || '(empty)'
  console.log(`✅  Connected! Model replied: "${reply}"`)
  console.log(`    Tokens used: ${data.usage?.total_tokens ?? 'n/a'}`)
  console.log(`    Finish: ${data.choices?.[0]?.finish_reason ?? 'n/a'}`)
  console.log()
} catch (err) {
  if (err.name === 'TimeoutError') {
    console.error('❌  Request timed out (15s). Check your network or the API endpoint.')
  } else {
    console.error(`❌  ${err.message}`)
  }
  process.exit(1)
}
