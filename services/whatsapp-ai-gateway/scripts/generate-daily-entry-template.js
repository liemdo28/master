require('dotenv').config();

const templateCache = require('../src/templates/template-cache');
const templateSync = require('../src/templates/template-sync-service');
const generator = require('../src/template-ocr/template-generator');
const printableForm = require('../src/forms/daily-entry-test-form-generator');
const guideGenerator = require('../src/forms/guide-generator');

async function main() {
  await templateCache.warmFromDb();
  if (process.argv.includes('--sync')) {
    await templateSync.syncOnce();
  }
  const result = generator.generateDailyEntryTemplate();
  const form = await printableForm.generateDailyEntryTestForm();
  const guides = guideGenerator.generateGuides();
  console.log(JSON.stringify({
    pdf: result.pdfPath,
    json: result.jsonPath,
    template_id: result.template.template_id,
    items: result.template.fields.length,
    source_sheet_version: result.template.source_sheet_version,
    printable_form: {
      pdf: form.pdfPath,
      xlsx: form.xlsxPath,
      md: form.mdPath,
      items: form.itemCount,
      form_id: form.formId,
    },
    guides,
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
