/**
 * Walkthrough Recorder - Captures user flows with screenshots
 * Usage: node record.js <flow-name>
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const FLOWS_DIR = path.join(__dirname, 'templates');
const CAPTURES_DIR = path.join(__dirname, 'captures');

async function record(flowName) {
  const templatePath = path.join(FLOWS_DIR, `${flowName}.json`);
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    console.log('Available templates:', fs.readdirSync(FLOWS_DIR).map(f => f.replace('.json', '')).join(', '));
    process.exit(1);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const captureDir = path.join(CAPTURES_DIR, flowName, new Date().toISOString().split('T')[0]);
  fs.mkdirSync(captureDir, { recursive: true });

  console.log(`Recording: ${template.name}`);
  console.log(`Steps: ${template.steps.length}`);
  console.log(`Output: ${captureDir}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordVideo: { dir: captureDir } });
  const page = await context.newPage();

  const results = [];

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i];
    console.log(`  [${i + 1}/${template.steps.length}] ${step.description}`);

    try {
      if (step.action === 'goto') await page.goto(BASE_URL + step.url);
      else if (step.action === 'fill') await page.fill(step.selector, step.value);
      else if (step.action === 'click') await page.click(step.selector);
      else if (step.action === 'wait') await page.waitForURL(new RegExp(step.pattern));
      else if (step.action === 'screenshot') { /* just capture below */ }

      // Capture screenshot
      const screenshotPath = path.join(captureDir, `step-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      results.push({ step: i + 1, description: step.description, status: 'pass', screenshot: screenshotPath });
    } catch (err) {
      const screenshotPath = path.join(captureDir, `step-${String(i + 1).padStart(2, '0')}-FAIL.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
      results.push({ step: i + 1, description: step.description, status: 'fail', error: err.message, screenshot: screenshotPath });
      console.error(`    FAILED: ${err.message}`);
    }
  }

  await context.close();
  await browser.close();

  // Save results
  const resultPath = path.join(captureDir, 'results.json');
  fs.writeFileSync(resultPath, JSON.stringify({ flow: flowName, template: template.name, date: new Date().toISOString(), results }, null, 2));
  console.log(`\nDone! Results: ${resultPath}`);
  console.log(`Pass: ${results.filter(r => r.status === 'pass').length}/${results.length}`);
}

const flowName = process.argv[2];
if (!flowName) {
  console.log('Usage: node record.js <flow-name>');
  console.log('Available:', fs.existsSync(FLOWS_DIR) ? fs.readdirSync(FLOWS_DIR).map(f => f.replace('.json', '')).join(', ') : 'none');
  process.exit(1);
}

record(flowName).catch(err => { console.error(err); process.exit(1); });
