const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function makeRunDir(baseDir = './data/uploads/template-ocr', now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = path.resolve(baseDir, date, runId);
  fs.mkdirSync(path.join(dir, 'crops'), { recursive: true });
  return dir;
}

async function preprocessTemplateImage(imagePath, template, metadata = {}) {
  const runDir = makeRunDir(undefined, metadata.now ? new Date(metadata.now) : new Date());
  const ext = path.extname(imagePath || '').toLowerCase();
  const originalPath = path.join(runDir, `original${ext || '.jpg'}`);
  const alignedPath = path.join(runDir, 'aligned.png');

  // Copy original
  fs.copyFileSync(imagePath, originalPath);

  // Convert HEIC / PDF to PNG if needed
  const convertedPath = await convertToPngIfNeeded(originalPath, ext, runDir);
  const workingPath = convertedPath || originalPath;

  const alignment = alignWithOpenCv(workingPath, alignedPath, template, runDir)
    || copyForBasicAlignment(workingPath, alignedPath);

  const crops = [];
  const sharp = getSharpInstance();
  for (const field of template.fields || []) {
    const cropName = `${slug(field.item_name)}.png`;
    const cropPath = path.join(runDir, 'crops', cropName);
    await writeCrop({ sharp, alignedPath, cropPath, field });
    crops.push({ item: field.item_name, crop_path: cropPath, box: field.reading_box });
  }

  return {
    runDir,
    originalPath,
    alignedPath,
    crops,
    alignment,
  };
}

/**
 * Convert HEIC, PDF, WEBP, or other formats to PNG using available tools.
 * Returns the converted PNG path, or null if no conversion needed.
 */
async function convertToPngIfNeeded(inputPath, ext, runDir) {
  const pngPath = path.join(runDir, 'converted.png');

  // Already PNG or JPG/JPEG — no conversion needed
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return null;

  // HEIC — try sharp-heic-converter first, then ImageMagick
  if (ext === '.heic') {
    const converted = await tryHeicConvert(inputPath, pngPath);
    if (converted) return pngPath;
  }

  // PDF — try pdftoppm (Poppler) or ImageMagick
  if (ext === '.pdf') {
    const converted = await tryPdfConvert(inputPath, pngPath);
    if (converted) return pngPath;
  }

  // WEBP — try sharp (usually supported)
  if (ext === '.webp') {
    const s = getSharpInstance();
    if (s) {
      try {
        await s(inputPath).png().toFile(pngPath);
        return pngPath;
      } catch (_) {}
    }
  }

  // GIF — convert to PNG
  if (ext === '.gif') {
    const s = getSharpInstance();
    if (s) {
      try {
        await s(inputPath).png().toFile(pngPath);
        return pngPath;
      } catch (_) {}
    }
  }

  return null;
}

async function tryHeicConvert(inputPath, outputPath) {
  // Try heic-convert npm package
  try {
    const heicConvert = require('heic-convert');
    const inputBuffer = fs.readFileSync(inputPath);
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'PNG',
      quality: 0.9,
    });
    fs.writeFileSync(outputPath, outputBuffer);
    return true;
  } catch (_) {}

  // Try sharp-heic-converter
  try {
    const sharp = getSharpInstance();
    if (sharp) {
      await sharp(inputPath).png().toFile(outputPath);
      return true;
    }
  } catch (_) {}

  // Try ImageMagick
  try {
    spawnSync('magick', [inputPath, outputPath], { windowsHide: true, timeout: 15000 });
    if (fs.existsSync(outputPath)) return true;
  } catch (_) {}

  // Try cwebp decode (if available)
  try {
    spawnSync('dwebp', [inputPath, '-o', outputPath], { windowsHide: true, timeout: 10000 });
    if (fs.existsSync(outputPath)) return true;
  } catch (_) {}

  return false;
}

async function tryPdfConvert(inputPath, outputPath) {
  // Try pdftoppm (Poppler utils)
  try {
    const ppmPath = path.join(path.dirname(outputPath), 'page');
    const result = spawnSync('pdftoppm', ['-png', '-r', '150', '-l', '1', inputPath, ppmPath], {
      windowsHide: true,
      timeout: 20000,
    });
    if (result.status === 0) {
      // Find the generated PNG
      const files = fs.readdirSync(path.dirname(ppmPath)).filter(f => f.startsWith('page'));
      if (files.length > 0) {
        const generated = path.join(path.dirname(ppmPath), files[0]);
        fs.copyFileSync(generated, outputPath);
        return true;
      }
    }
  } catch (_) {}

  // Try ImageMagick
  try {
    spawnSync('magick', ['-density', '150', inputPath + '[0]', outputPath], {
      windowsHide: true,
      timeout: 20000,
    });
    if (fs.existsSync(outputPath)) return true;
  } catch (_) {}

  return false;
}

function getSharpInstance() {
  try { return require('sharp'); } catch (_) { return null; }
}

function alignWithOpenCv(originalPath, alignedPath, template, runDir) {
  const templatePath = path.join(runDir, 'template.json');
  fs.writeFileSync(templatePath, JSON.stringify(template));
  const script = path.join(__dirname, 'opencv-align-template.py');
  const r = spawnSync('python', [script, originalPath, alignedPath, templatePath], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0 || !fs.existsSync(alignedPath)) return null;
  try {
    return { ...JSON.parse(r.stdout || '{}'), note: 'Perspective alignment completed with Python OpenCV.' };
  } catch (_) {
    return { status: 'ALIGNED_OPENCV', note: 'Perspective alignment completed with Python OpenCV.' };
  }
}

function copyForBasicAlignment(originalPath, alignedPath) {
  fs.copyFileSync(originalPath, alignedPath);
  const s = getSharpInstance();
  return {
    status: s ? 'ALIGNED_BASIC' : 'COPIED_NO_IMAGE_PROCESSOR',
    note: s
      ? 'OpenCV alignment unavailable; cropped with sharp using template coordinates.'
      : 'Install OpenCV or sharp for real alignment/cropping.',
  };
}

async function writeCrop({ sharp: cropper, alignedPath, cropPath, field }) {
  if (!cropper || !field.reading_box) {
    fs.copyFileSync(alignedPath, cropPath);
    return;
  }
  try {
    await cropper(alignedPath)
      .extract({
        left: Math.max(0, Math.round(field.reading_box.x)),
        top: Math.max(0, Math.round(field.reading_box.y)),
        width: Math.max(1, Math.round(field.reading_box.w)),
        height: Math.max(1, Math.round(field.reading_box.h)),
      })
      .greyscale()
      .normalise()
      .threshold(155)
      .png()
      .toFile(cropPath);
  } catch (err) {
    // Fallback: write a blank white image
    const s = getSharpInstance();
    if (s) {
      await s({
        create: {
          width: Math.max(1, Math.round(field.reading_box?.w || 120)),
          height: Math.max(1, Math.round(field.reading_box?.h || 38)),
          channels: 3,
          background: '#ffffff',
        },
      }).png().toFile(cropPath);
    } else {
      fs.copyFileSync(alignedPath, cropPath);
    }
  }
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'field';
}

module.exports = { preprocessTemplateImage };
