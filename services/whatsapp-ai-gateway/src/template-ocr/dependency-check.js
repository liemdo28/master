const { spawnSync } = require('child_process');
const fs = require('fs');

const WINDOWS_TESSERACT_PATHS = [
  'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
  'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
];

function commandOk(command, args = ['--version']) {
  const exe = resolveCommand(command);
  const r = spawnSync(exe, args, { encoding: 'utf8', shell: false });
  return {
    ok: r.status === 0,
    command: exe,
    version: (r.stdout || r.stderr || '').split(/\r?\n/)[0] || '',
    error: r.error?.message || (r.status === 0 ? '' : (r.stderr || '').trim()),
  };
}

function resolveCommand(command) {
  if (command !== 'tesseract') return command;
  for (const candidate of WINDOWS_TESSERACT_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return command;
}

function moduleOk(name) {
  try {
    require.resolve(name);
    return { ok: true, module: name };
  } catch (err) {
    return { ok: false, module: name, error: err.message };
  }
}

function pythonCv2Ok() {
  const r = spawnSync('python', ['-c', 'import cv2; print(cv2.__version__)'], { encoding: 'utf8', shell: false });
  return {
    ok: r.status === 0,
    module: 'python cv2',
    version: (r.stdout || '').trim(),
    error: r.error?.message || (r.status === 0 ? '' : (r.stderr || '').trim()),
  };
}

let cachedResult = null;
let cachedAt = 0;

function getCacheTtlMs() {
  return parseInt(process.env.OCR_DEP_CHECK_CACHE_MS || '60000', 10);
}

function checkOcrDeps(options = {}) {
  const now = Date.now();
  const ttlMs = getCacheTtlMs();
  if (!options.force && cachedResult && ttlMs > 0 && now - cachedAt < ttlMs) {
    return cachedResult;
  }

  const tesseract = commandOk('tesseract');
  const opencvCandidates = ['opencv4nodejs', '@u4/opencv4nodejs'];
  const nodeOpenCv = opencvCandidates.map(moduleOk).find(r => r.ok);
  const pythonOpenCv = pythonCv2Ok();
  const opencv = nodeOpenCv || pythonOpenCv.ok ? (nodeOpenCv || pythonOpenCv) : { ok: false, module: `${opencvCandidates.join(' or ')} or python cv2` };
  const sharp = moduleOk('sharp');
  cachedResult = {
    ok: tesseract.ok && (opencv.ok || sharp.ok),
    tesseract,
    opencv,
    sharp,
    notes: [
      tesseract.ok ? null : 'Install Tesseract OCR and add tesseract.exe to PATH.',
      (opencv.ok || sharp.ok) ? null : 'Install an image processing package such as OpenCV or sharp for alignment/cropping.',
    ].filter(Boolean),
  };
  cachedAt = now;
  return cachedResult;
}

module.exports = { checkOcrDeps };
module.exports.resolveCommand = resolveCommand;
