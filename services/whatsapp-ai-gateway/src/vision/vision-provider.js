/**
 * Vision Provider
 * 
 * Unified vision analysis for both:
 *   A) Incident detection (store operational issues)
 *   B) Temperature reading extraction (photo audit proof)
 * 
 * Supports: Gemini (primary), OpenAI Vision, Azure Vision, OpenAI-compatible
 * 
 * If no API key configured → graceful fallback (never crash)
 * 
 * Config:
 *   VISION_ENABLED=true
 *   VISION_PROVIDER=gemini|openai|azure|openai-compatible
 *   GEMINI_API_KEY=
 *   VISION_API_URL=
 *   VISION_API_KEY=
 *   VISION_MODEL=gpt-4o
 *   VISION_CONFIDENCE_THRESHOLD=0.75
 *   VISION_TEST_MODE=true
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../logger');

const log = makeLogger('vision');

// ── Config ────────────────────────────────────────────────────────────────────
function isEnabled() { return process.env.VISION_ENABLED === 'true'; }
function isTestMode() { return process.env.VISION_TEST_MODE !== 'false'; } // default true
function getProvider() { return process.env.VISION_PROVIDER || 'gemini'; }
function getConfidenceThreshold() { return parseFloat(process.env.VISION_CONFIDENCE_THRESHOLD || '0.75'); }
function getGeminiApiKey() { return (process.env.GEMINI_API_KEY || '').trim(); }
function getVisionApiKey() { return (process.env.VISION_API_KEY || '').trim(); }
function getVisionApiUrl() { return (process.env.VISION_API_URL || '').trim(); }
function getVisionModel() { return process.env.VISION_MODEL || 'gpt-4o'; }

// ── Provider: Gemini ───────────────────────────────────────────────────────────
async function analyzeWithGemini(imagePath, systemPrompt, userPrompt = '') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  const body = {
    contents: [{
      parts: [
        { text: systemPrompt + (userPrompt ? `\n\nUser query: ${userPrompt}` : '') },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
    },
  };

  const response = await geminiRequest(body, apiKey);
  return response;
}

// ── Provider: OpenAI-compatible (used for food safety) ─────────────────────────
async function analyzeWithOpenAI(imagePath, systemPrompt, userPrompt = '') {
  const apiUrl = getVisionApiUrl();
  const apiKey = getVisionApiKey();
  const model = getVisionModel();

  if (!apiUrl || !apiKey) throw new Error('VISION_API_URL / VISION_API_KEY not configured');

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  const isOpenAI = apiUrl.includes('api.openai.com') || apiUrl.includes('api.anthropic.com');
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt + (userPrompt ? `\n\nUser query: ${userPrompt}` : '') },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.1,
  });

  return openaiRequest(apiUrl, body, apiKey);
}

// ── Gemini HTTP request ────────────────────────────────────────────────────────
function geminiRequest(body, apiKey) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) reject(new Error(json.error.message || 'Gemini API error'));
          else {
            const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            resolve(content);
          }
        } catch (e) {
          reject(new Error(`Gemini parse failed: ${e.message}. Raw: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini request timeout')); });
    req.write(data);
    req.end();
  });
}

// ── OpenAI-compatible HTTP request ─────────────────────────────────────────────
function openaiRequest(apiUrl, body, apiKey) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const url = new URL(apiUrl);
    const data = body;
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    }, res => {
      let responseData = '';
      res.on('data', chunk => { responseData += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          let content = '';
          if (json.choices?.[0]?.message?.content) {
            content = json.choices[0].message.content;
          } else if (json.content) {
            content = json.content;
          } else {
            content = JSON.stringify(json);
          }
          resolve(content);
        } catch (e) {
          reject(new Error(`OpenAI parse failed: ${e.message}. Raw: ${responseData.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Vision API timeout')); });
    req.write(data);
    req.end();
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Analyze an image for incident detection (operational issues).
 * 
 * @param {string} imagePath  - absolute path to image
 * @param {object} metadata    - { chatId, sender, senderName, timestamp, groupName }
 * @returns {Promise<object>} - structured incident detection result
 */
async function analyzeIncident(imagePath, metadata = {}) {
  const { visionPrompts } = require('./vision-prompts');
  const systemPrompt = visionPrompts.incidentDetection();
  const userPrompt = `Image received in group ${metadata.groupName || 'Unknown'} from ${metadata.senderName || 'Unknown'}. Is there an operational incident?`;

  return callVision(imagePath, systemPrompt, userPrompt);
}

/**
 * Extract temperature reading from a proof photo.
 * 
 * @param {string} imagePath
 * @param {string} targetItem   - e.g. 'Walk-in Cooler'
 * @param {object} metadata    - { storeId, storeName }
 * @returns {Promise<object>} - { item, observed_value, unit, confidence, image_quality, needs_review }
 */
async function extractTemperatureReading(imagePath, targetItem, metadata = {}) {
  const { visionPrompts } = require('./vision-prompts');
  const systemPrompt = visionPrompts.temperatureExtraction();
  const userPrompt = `Extract the temperature reading for "${targetItem}" from this image. Store: ${metadata.storeName || 'Unknown'}`;

  return callVision(imagePath, systemPrompt, userPrompt);
}

/**
 * Core vision call — handles graceful fallback.
 */
async function callVision(imagePath, systemPrompt, userPrompt = '') {
  if (!isEnabled()) {
    log.warn('Vision not enabled — returning fallback');
    return { ok: false, reason: 'VISION_ENABLED=false', content: null };
  }

  const provider = getProvider();
  const hasKey = provider === 'gemini'
    ? !!getGeminiApiKey()
    : !!getVisionApiKey();

  if (!hasKey) {
    log.warn('Vision API key not configured', { provider });
    return { ok: false, reason: `${provider} API key not configured`, content: null };
  }

  try {
    let content;
    if (provider === 'gemini') {
      content = await analyzeWithGemini(imagePath, systemPrompt, userPrompt);
    } else {
      content = await analyzeWithOpenAI(imagePath, systemPrompt, userPrompt);
    }
    return { ok: true, content, provider };
  } catch (err) {
    log.error('Vision analysis failed', { provider, error: err.message });
    return { ok: false, reason: err.message, content: null };
  }
}

/**
 * Parse JSON from vision response (strips markdown code blocks).
 */
function parseJsonResponse(content) {
  if (!content) return null;
  let text = String(content).trim();
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (codeBlockMatch) text = codeBlockMatch[1].trim();
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return map[ext] || 'image/jpeg';
}

module.exports = {
  isEnabled,
  isTestMode,
  getProvider,
  getConfidenceThreshold,
  analyzeIncident,
  extractTemperatureReading,
  callVision,
  parseJsonResponse,
};