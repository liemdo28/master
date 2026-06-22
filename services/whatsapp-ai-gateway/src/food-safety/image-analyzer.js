/**
 * Image Analyzer
 * Extracts temperature readings from food safety board images.
 *
 * Uses a configurable VISION_API_URL (OpenAI Vision or OpenAI-compatible).
 * If no API is configured, returns NEEDS_REVIEW for every image — safe fallback.
 *
 * Output shape:
 * {
 *   store: "Bandera Road | Stone Oak | Medical Center | Unknown",
 *   date: "...",
 *   time: "AM | PM | Unknown",
 *   readings: [{ item, value, unit, confidence }],
 *   unclear_fields: [],
 *   needs_review: []
 * }
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { makeLogger } = require('../logger');
const { loadAliases, normalizeLabel } = require('./item-matcher');
const templateCache = require('../templates/template-cache');

const log = makeLogger('food-safety');

const KNOWN_ITEMS = [];

function getKnownItems() {
  const names = templateCache.getItemNames();
  return names.length ? names : KNOWN_ITEMS;
}

function buildSystemPrompt() {
  const items = getKnownItems();
  const itemList = items.length ? items.map(item => `- ${item}`).join('\n') : '- Use the current Daily_Entry_Template item names when visible.';
  return `You are a food safety board OCR and extraction system for Bakudan Ramen restaurants.

Given an image of a food safety temperature log board, extract ALL temperature readings you can find.

Respond ONLY with valid JSON in this exact format:
{
  "store": "Bandera Road | Stone Oak | Medical Center | Unknown",
  "date": "YYYY-MM-DD or date string from image",
  "time": "AM | PM | Unknown",
  "readings": [
    { "item": "Template item name", "value": 44, "unit": "F", "confidence": 0.91 }
  ],
  "unclear_fields": ["item names that are illegible or partially visible"],
  "needs_review": ["items that appear to be on the board but cannot be read with high confidence"]
}

Rules:
- Do NOT guess unclear values — mark them in unclear_fields or needs_review.
- If confidence in a reading is below 0.70, put it in needs_review.
- If an item name cannot be matched to a known template item, put it in needs_review.
- Known template items:
${itemList}
- Accept common board labels and normalize them to the closest current template item name.
- Unit defaults to "F" (Fahrenheit).
- Store: detect from visible text (Bandera Road, Stone Oak, Medical Center).
- If the image is blurry, dark, or mostly empty, return everything in needs_review.
- If no readings are found at all, return an empty readings array with "needs_review": ["*"].
- Never fabricate readings. Only report what you can actually see.`;
}

async function analyzeImage(imagePath) {
  const apiUrl = process.env.VISION_API_URL;
  const apiKey = process.env.VISION_API_KEY;

  if (!apiUrl || !apiKey) {
    log.warn('Vision API not configured — image will be marked NEEDS_REVIEW.');
    return {
      store: 'Unknown',
      date: '',
      time: 'Unknown',
      readings: [],
      unclear_fields: ['Vision API not configured — image will be marked NEEDS_REVIEW.'],
      needs_review: ['*'],
    };
  }

  // Read image as base64
  let imageBuffer;
  try {
    imageBuffer = fs.readFileSync(imagePath);
  } catch (err) {
    log.error('Failed to read image file', { path: imagePath, error: err.message });
    return { store: 'Unknown', date: '', time: 'Unknown', readings: [], unclear_fields: [], needs_review: ['*'] };
  }
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  log.info('Sending image to vision API', { path: imagePath, size: imageBuffer.length });

  try {
    const result = await callVisionApi(apiUrl, base64Image, mimeType, buildSystemPrompt());
    return postProcessResult(result);
  } catch (err) {
    log.error('Vision API call failed', { error: err.message });
    return {
      store: 'Unknown',
      date: '',
      time: 'Unknown',
      readings: [],
      unclear_fields: [],
      needs_review: ['*'],
    };
  }
}

async function callVisionApi(apiUrl, base64Image, mimeType, systemPrompt) {
  const isOpenAI = apiUrl.includes('api.openai.com') || apiUrl.includes('api.anthropic.com');
  const model = process.env.VISION_MODEL || 'gpt-4o';

  let body;
  let headers;

  if (isOpenAI) {
    body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all temperature readings from this food safety board image.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    });
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VISION_API_KEY || ''}`,
    };
  } else {
    // Generic OpenAI-compatible endpoint
    body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all temperature readings from this food safety board image.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    });
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VISION_API_KEY || ''}`,
    };
  }

  return new Promise((resolve, reject) => {
    const urlObj = new URL(apiUrl);
    const transport = urlObj.protocol === 'https:' ? https : http;
    const req = transport.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers,
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Try to extract content from various response formats
          let content = '';
          if (json.choices && json.choices[0]) {
            content = json.choices[0].message?.content || '';
          } else if (json.content) {
            content = json.content;
          } else {
            content = JSON.stringify(json);
          }
          resolve(content);
        } catch (e) {
          reject(new Error(`Failed to parse vision API response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Vision API timeout')); });
    req.write(body);
    req.end();
  });
}

function postProcessResult(rawContent) {
  // Strip markdown code blocks if present
  let content = rawContent.trim();
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (codeBlockMatch) content = codeBlockMatch[1];
  content = content.trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    log.warn('Vision API returned non-JSON, treating as unclear', { content: content.slice(0, 200) });
    return {
      store: 'Unknown',
      date: '',
      time: 'Unknown',
      readings: [],
      unclear_fields: [],
      needs_review: ['*'],
    };
  }

  // Validate and normalize
  const result = {
    store: normalizeStore(parsed.store || 'Unknown'),
    date: String(parsed.date || ''),
    time: normalizeTime(parsed.time || 'Unknown'),
    readings: [],
    unclear_fields: Array.isArray(parsed.unclear_fields) ? parsed.unclear_fields : [],
    needs_review: Array.isArray(parsed.needs_review) ? parsed.needs_review : [],
  };

  if (Array.isArray(parsed.readings)) {
    for (const r of parsed.readings) {
      const value = parseFloat(r.value);
      const confidence = parseFloat(r.confidence) || 0.5;
      if (isNaN(value)) {
        result.unclear_fields.push(r.item || 'unknown');
        continue;
      }
      const rawItem = String(r.item || '').trim();
      const item = canonicalizeKnownItem(rawItem);
      if (!item) {
        result.needs_review.push(rawItem || 'Unknown item');
        continue;
      }
      result.readings.push({
        item,
        value,
        unit: String(r.unit || 'F').trim(),
        confidence,
      });
    }
  }

  // If any reading confidence < 0.70, move to needs_review
  for (const r of result.readings) {
    if (r.confidence < 0.70) {
      result.needs_review.push(r.item);
    }
  }
  // Dedupe needs_review
  result.needs_review = [...new Set(result.needs_review)];

  log.info('Image analyzed', { store: result.store, readingsCount: result.readings.length, needsReviewCount: result.needs_review.length });
  return result;
}

function matchesKnownItem(item) {
  return !!canonicalizeKnownItem(item);
}

function canonicalizeKnownItem(item) {
  const raw = String(item || '').toLowerCase();
  if (!raw) return null;
  const normalized = normalizeLabel(raw);
  const aliases = loadAliases();

  for (const known of getKnownItems()) {
    if (normalizeLabel(known) === normalized) return known;
  }
  for (const known of getKnownItems()) {
    const configured = aliases[known] || [];
    if (configured.some(alias => normalizeLabel(alias) === normalized)) return known;
  }
  for (const known of getKnownItems()) {
    const k = normalizeLabel(known);
    if (normalized.includes(k) || k.includes(normalized)) return known;
  }
  return null;
}

function normalizeStore(raw) {
  const s = raw.toLowerCase();
  if (s.includes('bandera')) return 'Bandera Road';
  if (s.includes('stone oak') || s.includes('stoneoak')) return 'Stone Oak';
  if (s.includes('medical center') || s.includes('medicalcenter')) return 'Medical Center';
  return 'Unknown';
}

function normalizeTime(raw) {
  const s = String(raw).toUpperCase();
  if (s.includes('AM')) return 'AM';
  if (s.includes('PM')) return 'PM';
  return 'Unknown';
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return map[ext] || 'image/jpeg';
}

/**
 * Mock analyzer for testing without a real vision API.
 * Accepts a JSON fixture path or object.
 */
async function analyzeMock(imagePath, mockResult) {
  log.info('Using mock analyzer result', { path: imagePath });
  return mockResult;
}

module.exports = { analyzeImage, analyzeMock, KNOWN_ITEMS, getKnownItems, postProcessResult, canonicalizeKnownItem };
