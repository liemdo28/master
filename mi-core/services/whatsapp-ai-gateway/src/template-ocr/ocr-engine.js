const { spawn } = require('child_process');
const { checkOcrDeps, resolveCommand } = require('./dependency-check');

async function ocrCrop(cropPath) {
  const deps = checkOcrDeps();
  if (!deps.tesseract.ok) {
    return { raw_text: '', value: null, confidence: 0, status: 'NEEDS_REVIEW', error: 'Tesseract OCR not installed' };
  }

  const raw = await runTesseract(cropPath);
  const value = parseNumeric(raw.text);
  const confidence = raw.confidence ?? estimateConfidence(raw.text, value);
  return {
    raw_text: raw.text,
    value,
    confidence,
    status: value == null || confidence < 0.75 ? 'NEEDS_REVIEW' : 'OK',
    error: raw.error || '',
  };
}

async function ocrCrops(crops) {
  const results = [];
  for (const crop of crops) {
    const r = await ocrCrop(crop.crop_path);
    results.push({
      item: crop.item,
      raw_text: r.raw_text,
      value: r.value,
      confidence: r.confidence,
      crop_path: crop.crop_path,
      status: r.status,
      error: r.error,
    });
  }
  return results;
}

function runTesseract(cropPath) {
  return new Promise(resolve => {
    const args = [
      cropPath,
      'stdout',
      '--psm', '7',
      '-c', 'tessedit_char_whitelist=0123456789.-',
    ];
    const child = spawn(resolveCommand('tesseract'), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => resolve({ text: '', confidence: 0, error: err.message }));
    child.on('close', code => {
      resolve({
        text: stdout.trim(),
        confidence: code === 0 ? estimateConfidence(stdout, parseNumeric(stdout)) : 0,
        error: code === 0 ? '' : stderr.trim(),
      });
    });
  });
}

function parseNumeric(text) {
  const m = String(text || '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function estimateConfidence(text, value) {
  if (value == null) return 0;
  const cleaned = String(text || '').trim();
  return /^-?\d+(?:\.\d+)?$/.test(cleaned) ? 0.9 : 0.78;
}

module.exports = { ocrCrop, ocrCrops, parseNumeric };
