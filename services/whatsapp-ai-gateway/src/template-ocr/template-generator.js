const fs = require('fs');
const path = require('path');
const templateCache = require('../templates/template-cache');
const registry = require('./template-registry');

const OUTPUT_PDF = path.resolve('./docs/templates/daily-entry-template.pdf');
const TEMPLATE_ID = registry.DEFAULT_TEMPLATE_ID;

function buildTemplateDefinition(items = templateCache.getItems()) {
  const page = { width: 900, height: 1200, unit: 'pt' };
  const startY = 210;
  const rowH = 56;
  const fields = items.map((item, index) => {
    const y = startY + index * rowH;
    return {
      item_name: item.name,
      row: index + 1,
      target_min: item.min ?? null,
      target_max: item.max ?? null,
      reading_box: { x: 720, y: y + 8, w: 120, h: 38 },
    };
  });

  return {
    template_id: TEMPLATE_ID,
    template_name: 'Bakudan Daily Entry Printed Template',
    version: '1.0',
    page_size: page,
    form_id: TEMPLATE_ID,
    marker_positions: {
      top_left: { x: 36, y: 36, w: 26, h: 26 },
      top_right: { x: page.width - 62, y: 36, w: 26, h: 26 },
      bottom_left: { x: 36, y: page.height - 62, w: 26, h: 26 },
      bottom_right: { x: page.width - 62, y: page.height - 62, w: 26, h: 26 },
    },
    cell_coordinates: Object.fromEntries(fields.map(f => [slug(f.item_name), f.reading_box])),
    item_mapping: Object.fromEntries(fields.map(f => [String(f.row), f.item_name])),
    source_sheet_version: templateCache.getStatus().version,
    fields,
    generated_at: new Date().toISOString(),
  };
}

function generateDailyEntryTemplate({ pdfPath = OUTPUT_PDF } = {}) {
  const definition = buildTemplateDefinition();
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  registry.registerTemplate(definition);
  fs.writeFileSync(pdfPath, renderPdf(definition));
  return {
    pdfPath,
    jsonPath: registry.templatePath(definition.template_id),
    template: definition,
  };
}

function renderPdf(def) {
  const W = def.page_size.width;
  const H = def.page_size.height;
  const objects = [];
  const stream = [];
  const add = line => stream.push(line);

  add('0.08 0.10 0.14 rg');
  add(`0 0 ${W} ${H} re f`);
  add('1 1 1 rg');
  add('/F1 26 Tf 72 1132 Td (BAKUDAN DAILY ENTRY) Tj');
  add('/F1 11 Tf 0 -22 Td (Printed Template OCR - fill readings, photograph, send to WhatsApp) Tj');
  add('/F1 11 Tf 560 22 Td (FORM ID: daily-entry-v1) Tj');

  drawMarker(add, def.marker_positions.top_left);
  drawMarker(add, def.marker_positions.top_right);
  drawMarker(add, def.marker_positions.bottom_left);
  drawMarker(add, def.marker_positions.bottom_right);

  add('0.92 0.95 0.98 rg');
  add('/F1 13 Tf 72 1078 Td (Store: ____________________) Tj');
  add('/F1 13 Tf 300 0 Td (Date: ____________) Tj');
  add('/F1 13 Tf 485 0 Td (Shift: ________) Tj');
  add('/F1 13 Tf -485 -28 Td (Employee: ________________________________) Tj');

  add('0.12 0.18 0.28 rg');
  add('60 965 780 34 re f');
  add('1 1 1 rg');
  add('/F1 12 Tf 76 977 Td (Item) Tj');
  add('/F1 12 Tf 390 0 Td (Min) Tj');
  add('/F1 12 Tf 500 0 Td (Max) Tj');
  add('/F1 12 Tf 640 0 Td (Reading) Tj');

  for (const field of def.fields) {
    const y = 950 - (field.row - 1) * 38;
    if (y < 82) break;
    add('0.98 0.98 0.98 rg');
    add(`60 ${y - 8} 780 36 re f`);
    add('0.80 0.84 0.88 RG 0.6 w');
    add(`60 ${y - 8} 780 36 re S`);
    add('0.04 0.05 0.07 rg');
    add(`/F1 11 Tf 76 ${y + 3} Td (${pdfText(field.item_name)}) Tj`);
    add(`/F1 11 Tf 455 ${y + 3} Td (${field.target_min ?? ''}) Tj`);
    add(`/F1 11 Tf 560 ${y + 3} Td (${field.target_max ?? ''}) Tj`);
    add('1 1 1 rg');
    add(`720 ${y - 3} 100 26 re f`);
    add('0 0 0 RG 1.2 w');
    add(`720 ${y - 3} 100 26 re S`);
  }

  add('0.92 0.95 0.98 rg');
  add('/F1 10 Tf 72 54 Td (Keep all four black corner markers visible in the photo. Use one number per Reading box.) Tj');

  const content = stream.join('\n');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  return buildPdf(objects);
}

function drawMarker(add, m) {
  add('0 0 0 rg');
  add(`${m.x} ${1200 - m.y - m.h} ${m.w} ${m.h} re f`);
  add('1 1 1 rg');
  add(`${m.x + 7} ${1200 - m.y - m.h + 7} ${m.w - 14} ${m.h - 14} re f`);
  add('0 0 0 rg');
  add(`${m.x + 11} ${1200 - m.y - m.h + 11} ${m.w - 22} ${m.h - 22} re f`);
}

function buildPdf(objects) {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function pdfText(value) {
  return String(value || '').replace(/[()\\]/g, '\\$&');
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = {
  OUTPUT_PDF,
  buildTemplateDefinition,
  generateDailyEntryTemplate,
};
