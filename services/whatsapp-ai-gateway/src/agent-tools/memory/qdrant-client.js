'use strict';
/**
 * qdrant-client.js
 * Thin wrapper around Qdrant vector DB REST API.
 * Returns { ok: false } gracefully when not configured.
 */

const https = require('https');
const http  = require('http');
const { makeLogger } = require('../../logger');
const log = makeLogger('memory');

const QDRANT_URL        = process.env.QDRANT_URL || '';
const QDRANT_API_KEY    = process.env.QDRANT_API_KEY || '';
const COLLECTION        = process.env.QDRANT_COLLECTION || 'food_safety_memory';
const VECTOR_SIZE       = 384; // matches all-MiniLM-L6-v2 / simple hash fallback

function isConfigured() { return !!QDRANT_URL; }

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(path, QDRANT_URL);
    const mod  = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 6333),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 10000,
    };
    const req = mod.request(opts, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (_) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Qdrant request timed out')); });
    if (data) req.write(data);
    req.end();
  });
}

// Simple deterministic pseudo-vector from text (fallback when no embedding model)
function textToVector(text) {
  const vec = new Array(VECTOR_SIZE).fill(0);
  const s = String(text || '').toLowerCase();
  for (let i = 0; i < s.length; i++) {
    vec[i % VECTOR_SIZE] += s.charCodeAt(i) / 128;
  }
  const mag = Math.sqrt(vec.reduce((a, v) => a + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

async function ensureCollection() {
  if (!isConfigured()) return false;
  try {
    const check = await httpRequest('GET', `/collections/${COLLECTION}`);
    if (check.status === 200) return true;
    await httpRequest('PUT', `/collections/${COLLECTION}`, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    return true;
  } catch (err) {
    log.warn('Qdrant ensureCollection failed', { error: err.message });
    return false;
  }
}

async function upsert(id, text, payload) {
  if (!isConfigured()) return false;
  try {
    await ensureCollection();
    await httpRequest('PUT', `/collections/${COLLECTION}/points`, {
      points: [{ id: typeof id === 'number' ? id : Math.abs(hashCode(String(id))), vector: textToVector(text), payload: { ...payload, _text: text, _id: String(id) } }],
    });
    return true;
  } catch (err) {
    log.warn('Qdrant upsert failed', { error: err.message });
    return false;
  }
}

async function searchSimilar(queryText, limit = 10, filter = null) {
  if (!isConfigured()) return [];
  try {
    const body = { vector: textToVector(queryText), limit, with_payload: true };
    if (filter) body.filter = filter;
    const res = await httpRequest('POST', `/collections/${COLLECTION}/points/search`, body);
    return (res.body?.result || []).map(r => ({ score: r.score, ...r.payload }));
  } catch (err) {
    log.warn('Qdrant search failed', { error: err.message });
    return [];
  }
}

async function getStatus() {
  if (!isConfigured()) return { configured: false, url: null };
  try {
    const res = await httpRequest('GET', '/');
    return { configured: true, url: QDRANT_URL, collection: COLLECTION, reachable: res.status === 200, version: res.body?.version };
  } catch (err) {
    return { configured: true, url: QDRANT_URL, collection: COLLECTION, reachable: false, error: err.message };
  }
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return h;
}

module.exports = { isConfigured, upsert, searchSimilar, ensureCollection, getStatus };
