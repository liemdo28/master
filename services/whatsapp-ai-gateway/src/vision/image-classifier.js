/**
 * Image Classifier — determines image type for Food Safety routing
 *
 * Classification output:
 *   { type: 'line_check_form' | 'evidence_photo' | 'unknown',
 *     confidence: 0.0-1.0,
 *     subtype: 'cooler' | 'freezer' | 'thermometer' | 'fryer' | 'other' | null }
 *
 * Uses the same Vision API as image-analyzer (configured via VISION_API_URL / VISION_API_KEY).
 * If no Vision API configured, falls back to heuristic classification.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { makeLogger } = require('../logger');

const log = makeLogger('image-classifier');

const CLASSIFICATION_PROMPT = `You are a food safety image classifier for a restaurant.

Given an image, classify it into exactly one of these categories:

1. "line_check_form" — A completed paper line check / temperature log form.
   Examples: handwritten form with item names and temperature readings,
   pre-printed daily checklist with filled-in values, clipboard with form.

2. "evidence_photo" — A photo of restaurant equipment or food safety evidence.
   Subtypes:
   - "cooler" — Walk-in cooler, reach-in refrigerator, prep table with pans
   - "freezer" — Walk-in freezer, reach-in freezer
   - "thermometer" — A thermometer reading (digital or analog), temperature gun
   - "fryer" — Fryer station, fry baskets, fryer oil
   - "other" — Other food safety evidence not fitting above

3. "unknown" — Something else entirely, or unclear what it is.

Respond ONLY with valid JSON in this exact format:
{
  "type": "line_check_form | evidence_photo | unknown",
  "confidence": 0.95,
  "subtype": "cooler | freezer | thermometer | fryer | other | null",
  "reason": "Brief explanation"
}

Be strict — only classify as line_check_form if the image clearly shows a completed
form with fillable fields and temperatures. Equipment-only photos are evidence_photo.`;

/**
 * Classify an image using the Vision API.
 * @param {string} imagePath - Absolute path to image
 * @returns {Promise<{type: string, confidence: number, subtype: string|null, reason: string}>}
 */
async function classifyImage(imagePath) {
  const apiUrl = process.env.VISION_API_URL;
  const apiKey = process.env.VISION_API_KEY;

  if (!apiUrl || !apiKey) {
    log.warn('Vision API not configured — using heuristic classification');
    return classifyHeuristic(imagePath);
  }

  let imageBuffer;
  try {
    imageBuffer = fs.readFileSync(imagePath);
  } catch (err) {
    log.error('Failed to read image for classification', { path: imagePath, error: err.message });
    return { type: 'unknown', confidence: 0, subtype: null, reason: 'Cannot read image file' };
  }

  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  try {
    const result = await callVisionApi(apiUrl, base64Image, mimeType, CLASSIFICATION_PROMPT);
    return parseClassificationResult(result);
  } catch (err) {
    log.error('Vision classification failed, falling back to heuristic', { error: err.message });
    return classifyHeuristic(imagePath);
  }
}

/**
 * Heuristic classification fallback (no Vision API).
 * Uses file size, dimensions, and basic image properties.
 */
function classifyHeuristic(imagePath) {
  try {
    const stats = fs.statSync(imagePath);
    const sizeKB = stats.size / 1024;
    if (sizeKB < 20) {
      return { type: 'unknown', confidence: 0.3, subtype: null, reason: 'Image too small for reliable classification' };
    }
    return { type: 'unknown', confidence: 0.4, subtype: null, reason: 'Vision API unavailable — manual review needed' };
  } catch (err) {
    return { type: 'unknown', confidence: 0, subtype: null, reason: err.message };
  }
}

async function callVisionApi(apiUrl, base64Image, mimeType, systemPrompt) {
  const model = process.env.VISION_MODEL || 'gpt-4o';
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Classify this image.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      },
    ],
    max_tokens: 512,
    temperature: 0.1,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.VISION_API_KEY || ''}`,
  };

  return new Promise((resolve, reject) => {
    const urlObj = new URL(apiUrl);
    const transport = urlObj.protocol === 'https:' ? https : http;
    const req = transport.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers,
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
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
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Vision API timeout')); });
    req.write(body);
    req.end();
  });
}

function parseClassificationResult(rawContent) {
  let content = rawContent.trim();
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (codeBlockMatch) content = codeBlockMatch[1];
  content = content.trim();

  try {
    const parsed = JSON.parse(content);
    const type = parsed.type || 'unknown';
    if (!['line_check_form', 'evidence_photo', 'unknown'].includes(type)) {
      return { type: 'unknown', confidence: 0, subtype: null, reason: 'Invalid type returned' };
    }
    return {
      type,
      confidence: parseFloat(parsed.confidence) || 0.5,
      subtype: parsed.subtype || null,
      reason: parsed.reason || '',
    };
  } catch (err) {
    return { type: 'unknown', confidence: 0, subtype: null, reason: 'Could not parse classification result' };
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return map[ext] || 'image/jpeg';
}

module.exports = { classifyImage, classifyHeuristic, parseClassificationResult };
