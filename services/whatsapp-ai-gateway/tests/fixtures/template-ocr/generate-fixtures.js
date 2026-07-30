/**
 * Generate real image fixtures for Template OCR pilot runtime validation.
 *
 * Produces actual files on disk that the OCR pipeline can preprocess:
 *   - completed-form.jpg   (JPEG)
 *   - completed-form.png   (PNG)
 *   - completed-form.heic  (only if HEIC encoder available — else skipped)
 *   - completed-form.pdf   (PDF, via the real template generator)
 *
 * Each raster fixture renders the form title "BAKUDAN DAILY ENTRY" plus the
 * FORM ID and filled reading values so Tesseract has real text to read.
 *
 * The PDF fixture reuses the production template generator so the routing/
 * conversion path (pdftoppm / ImageMagick) is exercised end to end.
 */
const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.resolve(__dirname);

function getSharp() {
  try { return require('sharp'); } catch (_) { return null; }
}

/**
 * Build an SVG that resembles a filled Daily Entry form.
 * Reading values are placed near the right edge to mirror the real
 * template's reading_box positions.
 */
function buildFormSvg({ store = 'Rim', readings = [] } = {}) {
  const width = 900;
  const height = 1200;
  const rows = readings.map((r, idx) => {
    const y = 230 + idx * 56;
    return `
      <text x="76" y="${y}" font-family="DejaVu Sans, Arial" font-size="22" fill="#000">${r.item}</text>
      <text x="455" y="${y}" font-family="DejaVu Sans, Arial" font-size="22" fill="#000">${r.min ?? ''}</text>
      <text x="560" y="${y}" font-family="DejaVu Sans, Arial" font-size="22" fill="#000">${r.max ?? ''}</text>
      <rect x="720" y="${y - 26}" width="120" height="38" fill="#fff" stroke="#000" stroke-width="2"/>
      <text x="745" y="${y}" font-family="DejaVu Sans, Arial" font-size="26" fill="#000">${r.value}</text>`;
  }).join('\n');

  // Four black corner markers so OpenCV alignment has anchors.
  const marker = (x, y) => `<rect x="${x}" y="${y}" width="26" height="26" fill="#000"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#ffffff"/>
    ${marker(36, 36)}
    ${marker(width - 62, 36)}
    ${marker(36, height - 62)}
    ${marker(width - 62, height - 62)}
    <text x="72" y="80" font-family="DejaVu Sans, Arial" font-size="34" font-weight="bold" fill="#000">BAKUDAN DAILY ENTRY</text>
    <text x="560" y="120" font-family="DejaVu Sans, Arial" font-size="18" fill="#000">FORM ID: daily-entry-v1</text>
    <text x="72" y="150" font-family="DejaVu Sans, Arial" font-size="22" fill="#000">Store: ${store}</text>
    ${rows}
  </svg>`;
}

async function generateRaster({ ext, store, readings }) {
  const sharp = getSharp();
  if (!sharp) throw new Error('sharp unavailable — cannot generate raster fixtures');
  const svg = buildFormSvg({ store, readings });
  const out = path.join(FIXTURE_DIR, `completed-form.${ext}`);
  let pipeline = sharp(Buffer.from(svg));
  if (ext === 'jpg' || ext === 'jpeg') pipeline = pipeline.jpeg({ quality: 92 });
  else if (ext === 'png') pipeline = pipeline.png();
  else if (ext === 'heic') {
    // HEIF encode is only available if libvips was built with HEIF support.
    pipeline = pipeline.heif({ compression: 'av1' });
  } else if (ext === 'webp') pipeline = pipeline.webp();
  await pipeline.toFile(out);
  return out;
}

async function generatePdf() {
  const generator = require('../../../src/template-ocr/template-generator');
  const out = path.join(FIXTURE_DIR, 'completed-form.pdf');
  const result = generator.generateDailyEntryTemplate({ pdfPath: out });
  return result.pdfPath;
}

const DEFAULT_READINGS = [
  { item: 'Walk-in Cooler', min: 30, max: 40, value: 38 },
  { item: 'Walk-in Freezer', min: null, max: 0, value: -2 },
  { item: 'Prep Area Cooler', min: 30, max: 41, value: 39 },
];

async function generateAll({ store = 'Rim', readings = DEFAULT_READINGS } = {}) {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const made = {};
  made.jpg = await generateRaster({ ext: 'jpg', store, readings });
  made.png = await generateRaster({ ext: 'png', store, readings });
  try {
    made.heic = await generateRaster({ ext: 'heic', store, readings });
  } catch (err) {
    made.heicError = err.message;
  }
  try {
    made.pdf = await generatePdf();
  } catch (err) {
    made.pdfError = err.message;
  }
  return made;
}

module.exports = { generateAll, generateRaster, generatePdf, buildFormSvg, DEFAULT_READINGS, FIXTURE_DIR };

// Allow standalone run: `node tests/fixtures/template-ocr/generate-fixtures.js`
if (require.main === module) {
  generateAll().then(made => {
    console.log('Fixtures generated:');
    console.log(JSON.stringify(made, null, 2));
  }).catch(err => {
    console.error('Fixture generation failed:', err.stack || err.message);
    process.exit(1);
  });
}
