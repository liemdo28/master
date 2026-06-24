const fs = require('fs');
const path = require('path');

const STAFF_MD_PATH = path.resolve('./docs/STAFF_USER_GUIDE_EN.md');
const STAFF_PDF_PATH = path.resolve('./docs/STAFF_USER_GUIDE_EN.pdf');
const MANAGER_MD_PATH = path.resolve('./docs/MANAGER_QUICK_GUIDE_EN.md');

const QUICK_GUIDE = `How to use WhatsApp Daily Entry:

1. Open the store WhatsApp group.
2. Type:
/ldagent

3. Choose:
1 — Daily Entry Log

4. The bot will ask one item at a time.

Example:
Walk-in Cooler
Target: 30°F - 45°F
Reply with temperature:

5. Type the reading:
38

6. If the value is outside range, the bot will ask:

1 — Confirm actual reading
2 — Re-enter value
3 — Skip this item

7. At the end, review the summary.

8. Reply:
CONFIRM

Only CONFIRM saves the log.`;

function staffGuideMarkdown() {
  return `# Bakudan WhatsApp Daily Entry Guide

## 1. What this system does

This system helps staff submit daily temperature and operations readings in WhatsApp. The bot asks for each item from the current Daily Entry Template, checks the target range, shows warnings when needed, and saves the final confirmed log.

## 2. How to start

Open the store WhatsApp group and type:

\`\`\`text
/ldagent
\`\`\`

Choose Daily Entry Log when the bot asks what you want to do.

## 3. How to enter daily readings

The bot asks one item at a time. Reply with the number you measured. Use a clear number like \`38\`, \`40.5\`, or \`-5\`.

## 4. What to do if a number is outside range

If the value is outside the target range, the bot will ask you to confirm the real reading, re-enter the value, or skip the item if unavailable. Confirm only if the number is the actual measured value.

## 5. How to edit a mistake

Use:

\`\`\`text
EDIT 1 40
\`\`\`

This changes item 1 to 40. You can also follow the bot prompt if it asks you to re-enter a value.

## 6. How to cancel

Use:

\`\`\`text
CANCEL
\`\`\`

Cancel stops the current entry. Nothing is saved until you reply CONFIRM at the final summary.

## 7. How to submit

Review the final summary. If everything is correct, reply:

\`\`\`text
CONFIRM
\`\`\`

Only CONFIRM saves the log.

## 8. How to use printed form OCR

Print the Daily Entry Test Form. Fill every reading by hand. Take a clear photo of the full page with all four corner markers visible. Send the photo to the WhatsApp test group and wait for the bot summary. Reply CONFIRM if correct, or EDIT if needed.

## 9. What manager alerts mean

Manager alerts mean a reading may need attention, such as an out-of-range value, a missing entry, or a value that needs review. Follow store policy and manager instructions.

## 10. Supported languages

The bot supports English, Spanish, Vietnamese, and French for the main guided workflow.

## 11. Common commands

\`\`\`text
/ldagent
/help
/status
/cancel
/language en
/language es
/language vi
/language fr
\`\`\`

Common replies:

\`\`\`text
CONFIRM
EDIT 1 40
CANCEL
STATUS
SKIP
\`\`\`

## 12. Troubleshooting

- If the bot does not answer, check that the gateway is running.
- If you entered the wrong value, use EDIT before CONFIRM.
- If the item is unavailable, use SKIP or write N/A on the printed form.
- If a photo is blurry, retake it with better lighting.
- If the bot summary looks wrong, do not CONFIRM. Use EDIT or ask a manager.

## Quick Guide

${QUICK_GUIDE}
`;
}

function managerGuideMarkdown() {
  return `# Manager Quick Guide

## Manager responsibilities

- Make sure staff submit daily entries.
- Watch manager alert group.
- Check warnings.
- Verify out-of-range values.
- Review dashboard history.
- Confirm Google Sheet records.

## Manager group commands

\`\`\`text
/history today
/summary today
/who Walk-in Cooler today
/status
\`\`\`

## Daily check

1. Confirm each active store has submitted the Daily Entry Log.
2. Review out-of-range warnings.
3. Follow up with staff when a value is missing or unclear.
4. Check the dashboard history if a WhatsApp message needs review.
5. Confirm the Google Sheet has the expected record.
`;
}

function generateGuides() {
  fs.mkdirSync(path.dirname(STAFF_MD_PATH), { recursive: true });
  const staff = staffGuideMarkdown();
  const manager = managerGuideMarkdown();
  fs.writeFileSync(STAFF_MD_PATH, staff, 'utf8');
  fs.writeFileSync(MANAGER_MD_PATH, manager, 'utf8');
  fs.writeFileSync(STAFF_PDF_PATH, renderTextPdf(staff));
  return {
    staffMdPath: STAFF_MD_PATH,
    staffPdfPath: STAFF_PDF_PATH,
    managerMdPath: MANAGER_MD_PATH,
  };
}

function renderTextPdf(markdown) {
  const W = 612;
  const H = 792;
  const margin = 48;
  const maxChars = 88;
  const lines = markdown
    .replace(/```text/g, '')
    .replace(/```/g, '')
    .split(/\r?\n/)
    .flatMap(line => wrapLine(line, maxChars));

  const objects = [];
  const pages = [];
  for (let i = 0; i < lines.length; i += 46) {
    const pageLines = lines.slice(i, i + 46);
    const stream = [];
    let y = H - margin;
    for (const line of pageLines) {
      const size = line.startsWith('# ') ? 18 : line.startsWith('## ') ? 13 : 9;
      const text = line.replace(/^#+\s*/, '');
      stream.push(`/F1 ${size} Tf ${margin} ${y} Td (${pdfText(text)}) Tj`);
      y -= size === 18 ? 22 : 15;
    }
    const content = stream.join('\n');
    const pageObj = objects.length + 4;
    const contentObj = pageObj + 1;
    pages.push(`${pageObj} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 1 0 R >> >> /Contents ${contentObj} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }

  const allObjects = [
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Type /Pages /Kids [${pages.join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Catalog /Pages 2 0 R >>',
    ...objects,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < allObjects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${allObjects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${allObjects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${allObjects.length + 1} /Root 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function wrapLine(line, maxChars) {
  if (line.length <= maxChars) return [line];
  const out = [];
  let current = '';
  for (const word of line.split(/\s+/)) {
    if ((current + ' ' + word).trim().length > maxChars) {
      out.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) out.push(current);
  return out;
}

function pdfText(value) {
  return String(value || '')
    .replace(/[()\\]/g, '\\$&')
    .replace(/—/g, '-')
    .replace(/°/g, '\\260')
    .replace(/[^\x09\x0a\x0d\x20-\x7e\\]/g, '');
}

module.exports = {
  QUICK_GUIDE,
  STAFF_MD_PATH,
  STAFF_PDF_PATH,
  MANAGER_MD_PATH,
  staffGuideMarkdown,
  managerGuideMarkdown,
  generateGuides,
};
