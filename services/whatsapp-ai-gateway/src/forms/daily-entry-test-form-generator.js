const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const templateCache = require('../templates/template-cache');

const OUT_DIR = path.resolve('./docs/templates');
const FORM_ID = 'BAKUDAN-DAILY-ENTRY-TEST-FORM';
const FORM_VERSION = 'v1.0.0';
const PDF_PATH = path.join(OUT_DIR, 'BAKUDAN_DAILY_ENTRY_TEST_FORM.pdf');
const XLSX_PATH = path.join(OUT_DIR, 'BAKUDAN_DAILY_ENTRY_TEST_FORM.xlsx');
const MD_PATH = path.join(OUT_DIR, 'BAKUDAN_DAILY_ENTRY_TEST_FORM.md');

function getTemplateItems() {
  return templateCache.getItems()
    .filter(item => item && item.name)
    .slice(0, 25)
    .map((item, idx) => ({
      index: idx + 1,
      name: item.name,
      min: item.min ?? null,
      max: item.max ?? null,
      unit: item.unit || 'F',
      target: formatTarget(item.min ?? null, item.max ?? null, item.unit || 'F'),
    }));
}

function formatTarget(min, max, unit = 'F') {
  const suffix = unit === 'F' ? '\u00b0F' : unit;
  if (min != null && max != null) return `${min}${suffix} - ${max}${suffix}`;
  if (max != null) return `<= ${max}${suffix}`;
  if (min != null) return `>= ${min}${suffix}`;
  return 'Not configured';
}

async function generateDailyEntryTestForm(options = {}) {
  if (!options.items && templateCache.getItems().length === 0) await templateCache.warmFromDb();
  const items = options.items || getTemplateItems();
  if (items.length === 0) throw new Error('Daily_Entry_Template has no items. Sync template before generating form.');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const metadata = {
    formId: FORM_ID,
    formVersion: FORM_VERSION,
    templateVersion: templateCache.getStatus().version || 'unknown',
    generatedAt,
    itemCount: items.length,
  };

  fs.writeFileSync(MD_PATH, renderMarkdown(items, metadata), 'utf8');
  fs.writeFileSync(PDF_PATH, await renderPdf(items, metadata));
  fs.writeFileSync(XLSX_PATH, renderXlsx(items, metadata));

  return {
    ok: true,
    pdfPath: PDF_PATH,
    xlsxPath: XLSX_PATH,
    mdPath: MD_PATH,
    itemCount: items.length,
    formId: metadata.formId,
    formVersion: metadata.formVersion,
    templateVersion: metadata.templateVersion,
  };
}

function renderMarkdown(items, meta) {
  const rows = items.map(item =>
    `| ${item.index} | ${item.name} | ${item.target} |  |  |`
  ).join('\n');
  return `# BAKUDAN DAILY ENTRY TEST FORM

Form ID: ${meta.formId}
Form Version: ${meta.formVersion}
Template Version: ${meta.templateVersion}
Generated: ${meta.generatedAt}

Store:
Date:
Shift:
Employee:
Manager:
Page:

## How to use

1. Fill Store, Date, Shift, and Employee Name.
2. Write one reading for each item.
3. Do not skip any item unless unavailable.
4. If unavailable, write N/A and add a note.
5. Take a clear photo of the full page.
6. Make sure all four corners are visible.
7. Send the photo to the WhatsApp test group.
8. Wait for the bot summary.
9. Reply CONFIRM if correct, or EDIT if needed.

## Photo rules

- Good lighting
- No blur
- No cut-off corners
- Keep paper flat
- Do not fold
- Do not use pencil if too light

| # | Item | Target Range | Reading | Notes |
|---|------|--------------|---------|-------|
${rows}

Footer: Take a clear photo and send it to the WhatsApp test group.
`;
}

async function renderPdf(items, meta) {
  const W = 900;
  const H = 1200;
  const stream = [];
  const add = line => stream.push(line);
  const qr = QRCode.create(meta.formId, { errorCorrectionLevel: 'M', margin: 0 });

  add('1 1 1 rg');
  add(`0 0 ${W} ${H} re f`);
  drawMarker(add, 36, H - 62, 26);
  drawMarker(add, W - 62, H - 62, 26);
  drawMarker(add, 36, 36, 26);
  drawMarker(add, W - 62, 36, 26);

  add('0.04 0.05 0.07 rg');
  text(add, 70, 1138, 25, 'BAKUDAN DAILY ENTRY TEST FORM');
  text(add, 70, 1115, 10, `FORM ID: ${meta.formId}    Form Version: ${meta.formVersion}    Template: ${meta.templateVersion}`);
  drawQr(add, qr, 725, 1060, 90);

  text(add, 70, 1082, 12, 'Store: ____________________        Date: ____________        Shift: ________');
  text(add, 70, 1058, 12, 'Employee: ____________________     Manager: ____________________     Page: ____');

  add('0.93 0.96 1 rg');
  add('70 920 760 116 re f');
  add('0.55 0.62 0.72 RG 1 w');
  add('70 920 760 116 re S');
  add('0.04 0.05 0.07 rg');
  text(add, 84, 1018, 11, 'How to use: 1. Fill Store, Date, Shift, and Employee Name. 2. Write one reading for each item.');
  text(add, 84, 1000, 11, '3. Do not skip any item unless unavailable. 4. If unavailable, write N/A and add a note.');
  text(add, 84, 982, 11, '5. Take a clear photo of the full page. 6. Make sure all four corners are visible.');
  text(add, 84, 964, 11, '7. Send the photo to the WhatsApp test group. 8. Wait for the bot summary.');
  text(add, 84, 946, 11, '9. Reply CONFIRM if correct, or EDIT if needed.');
  text(add, 84, 928, 10, 'Photo rules: Good lighting. No blur. No cut-off corners. Keep paper flat. Do not fold. Do not use light pencil.');

  add('0.10 0.16 0.24 rg');
  add('70 884 760 28 re f');
  add('1 1 1 rg');
  text(add, 84, 893, 11, '#');
  text(add, 120, 893, 11, 'Item');
  text(add, 390, 893, 11, 'Target Range');
  text(add, 535, 893, 11, 'Reading');
  text(add, 680, 893, 11, 'Notes');

  const rowH = 40;
  let y = 844;
  for (const item of items) {
    add(item.index % 2 ? '0.99 0.99 0.99 rg' : '0.95 0.97 0.99 rg');
    add(`70 ${y - 10} 760 ${rowH} re f`);
    add('0.78 0.82 0.88 RG 0.7 w');
    add(`70 ${y - 10} 760 ${rowH} re S`);
    add('0.04 0.05 0.07 rg');
    text(add, 84, y + 4, 10, String(item.index));
    text(add, 120, y + 4, 10, truncate(item.name, 34));
    text(add, 390, y + 4, 10, item.target);
    add('1 1 1 rg');
    add(`530 ${y - 4} 118 26 re f`);
    add('0 0 0 RG 1.2 w');
    add(`530 ${y - 4} 118 26 re S`);
    add('1 1 1 rg');
    add(`675 ${y - 4} 135 26 re f`);
    add('0.55 0.62 0.72 RG 0.8 w');
    add(`675 ${y - 4} 135 26 re S`);
    y -= rowH;
  }

  add('0.04 0.05 0.07 rg');
  text(add, 70, 54, 11, 'Take a clear photo and send it to the WhatsApp test group.');

  return buildPdf(W, H, stream.join('\n'));
}

function text(add, x, y, size, value) {
  add(`/F1 ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj`);
}

function drawMarker(add, x, y, size) {
  add('0 0 0 rg');
  add(`${x} ${y} ${size} ${size} re f`);
  add('1 1 1 rg');
  add(`${x + 7} ${y + 7} ${size - 14} ${size - 14} re f`);
  add('0 0 0 rg');
  add(`${x + 11} ${y + 11} ${size - 22} ${size - 22} re f`);
}

function drawQr(add, qr, x, y, size) {
  const count = qr.modules.size;
  const cell = size / count;
  add('1 1 1 rg');
  add(`${x - 4} ${y - 4} ${size + 8} ${size + 8} re f`);
  add('0 0 0 rg');
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(row, col)) {
        const px = x + col * cell;
        const py = y + size - (row + 1) * cell;
        add(`${px.toFixed(2)} ${py.toFixed(2)} ${Math.ceil(cell * 100) / 100} ${Math.ceil(cell * 100) / 100} re f`);
      }
    }
  }
}

function buildPdf(width, height, content) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function renderXlsx(items, meta) {
  const rows = [
    ['BAKUDAN DAILY ENTRY TEST FORM'],
    [`Form ID: ${meta.formId}`, `Form Version: ${meta.formVersion}`, `Template: ${meta.templateVersion}`],
    ['Store:', '', 'Date:', '', 'Shift:', ''],
    ['Employee:', '', 'Manager:', '', 'Page:', ''],
    [],
    ['How to use:', 'Fill Store, Date, Shift, and Employee Name. Write one reading for each item. Use N/A only if unavailable. Send a clear photo to the WhatsApp test group.'],
    ['Photo rules:', 'Good lighting; no blur; no cut-off corners; keep paper flat; do not fold; do not use light pencil.'],
    [],
    ['#', 'Item', 'Target Range', 'Reading', 'Notes'],
    ...items.map(item => [item.index, item.name, item.target, '', '']),
    [],
    ['Footer:', 'Take a clear photo and send it to the WhatsApp test group.'],
  ];
  return createXlsx(rows);
}

function createXlsx(rows) {
  const sheetRows = rows.map((row, rIdx) => {
    const cells = row.map((value, cIdx) => {
      const ref = `${columnName(cIdx + 1)}${rIdx + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlText(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rIdx + 1}">${cells}</row>`;
  }).join('');
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Daily Entry Test Form" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="5" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="20" customWidth="1"/><col min="5" max="5" width="28" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  return zipStore(files);
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralStart = offset;
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  const fileCount = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(fileCount, 8);
  end.writeUInt16LE(fileCount, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

function crc32(buffer) {
  return crc32Impl(buffer);
}

let _crcTable = null;
function crcTable() {
  if (_crcTable) return _crcTable;
  _crcTable = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    _crcTable[n] = c >>> 0;
  }
  return _crcTable;
}

function crc32Impl(buffer) {
  const table = crcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function columnName(index) {
  let n = index;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function truncate(value, max) {
  const s = String(value || '');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function pdfText(value) {
  return String(value || '')
    .replace(/[()\\]/g, '\\$&')
    .replace(/°/g, '\\260')
    .replace(/[^\x09\x0a\x0d\x20-\x7e\\]/g, '?');
}

function xmlText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  FORM_ID,
  FORM_VERSION,
  PDF_PATH,
  XLSX_PATH,
  MD_PATH,
  OUT_DIR,
  formatTarget,
  getTemplateItems,
  generateDailyEntryTestForm,
};
