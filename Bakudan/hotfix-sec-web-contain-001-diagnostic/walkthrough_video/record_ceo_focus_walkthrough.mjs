import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.CEO_WALKTHROUGH_URL || 'https://dashboard.bakudanramen.com';
const email = process.env.CEO_WALKTHROUGH_EMAIL;
const password = process.env.CEO_WALKTHROUGH_PASSWORD;
const chromeExe = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve('walkthrough_video');

if (!email || !password) {
  throw new Error('CEO_WALKTHROUGH_EMAIL and CEO_WALKTHROUGH_PASSWORD are required.');
}

const subtitleLines = [
  ['00:00:00,000', '00:00:04,000', 'CEO Dashboard Walkthrough: start with the Today Brief.'],
  ['00:00:04,000', '00:00:08,000', 'The top panel reduces the dashboard to three CEO decisions.'],
  ['00:00:08,000', '00:00:11,500', 'First: review the highest-ranked decision for today.'],
  ['00:00:11,500', '00:00:15,000', 'Second: open Pay / File for bills, tax, and cash-risk items.'],
  ['00:00:15,000', '00:00:18,500', 'Third: follow up on overdue tasks, compliance, and overloaded teams.'],
  ['00:00:18,500', '00:00:23,000', 'Detailed finance, operations, and compliance panels stay below as drill-downs.'],
  ['00:00:23,000', '00:00:26,800', 'The sidebar now repeats the same three CEO entry points.'],
];

function buildSrt(lines) {
  return lines.map((line, index) => `${index + 1}\n${line[0]} --> ${line[1]}\n${line[2]}\n`).join('\n');
}

async function caption(page, text) {
  await page.evaluate((message) => {
    let el = document.getElementById('walkthroughCaption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'walkthroughCaption';
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:28px',
        'transform:translateX(-50%)',
        'z-index:999999',
        'max-width:min(920px, calc(100vw - 48px))',
        'background:rgba(2,6,23,.92)',
        'color:#f8fafc',
        'border:1px solid rgba(148,163,184,.38)',
        'border-radius:8px',
        'padding:12px 18px',
        'font:700 18px/1.35 system-ui, -apple-system, Segoe UI, sans-serif',
        'text-align:center',
        'box-shadow:0 18px 44px rgba(0,0,0,.34)',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = message;
  }, text);
}

async function focus(page, selector) {
  await page.evaluate((sel) => {
    document.querySelectorAll('.walkthrough-focus').forEach((node) => {
      node.classList.remove('walkthrough-focus');
      node.style.outline = '';
      node.style.boxShadow = '';
    });
    const el = document.querySelector(sel);
    if (el) {
      el.classList.add('walkthrough-focus');
      el.style.outline = '3px solid #60a5fa';
      el.style.boxShadow = '0 0 0 8px rgba(96,165,250,.18)';
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    }
  }, selector);
}

async function pause(ms = 2600) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'ceo_focus_walkthrough_en.srt'), buildSrt(subtitleLines), 'utf8');

const browser = await chromium.launch({
  headless: true,
  executablePath: chromeExe,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: outDir,
    size: { width: 1440, height: 900 },
  },
});

const page = await context.newPage();
await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await caption(page, 'CEO Dashboard Walkthrough: start with the Today Brief.');
await pause(1200);
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password').fill(password);
await Promise.all([
  page.waitForURL('**/overview', { timeout: 60000 }),
  page.getByRole('button', { name: 'Sign In' }).click(),
]);
await page.waitForLoadState('domcontentloaded', { timeout: 60000 });

await caption(page, 'The top panel reduces the dashboard to three CEO decisions.');
await focus(page, '#ceo-today');
await pause();

await caption(page, 'First: review the highest-ranked decision for today.');
await focus(page, '.ceo-focus-card:nth-of-type(1)');
await pause();

await caption(page, 'Second: open Pay / File for bills, tax, and cash-risk items.');
await focus(page, '.ceo-focus-card:nth-of-type(2)');
await pause();

await caption(page, 'Third: follow up on overdue tasks, compliance, and overloaded teams.');
await focus(page, '.ceo-focus-card:nth-of-type(3)');
await pause();

await caption(page, 'Detailed finance, operations, and compliance panels stay below as drill-downs.');
await page.evaluate(() => window.scrollTo({ top: Math.min(document.body.scrollHeight, 900), behavior: 'smooth' }));
await pause(3000);

await caption(page, 'The sidebar now repeats the same three CEO entry points.');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await pause(1200);
await focus(page, '.sb-group');
await pause(3000);

const hasCeoFocus = await page.locator('#ceo-today').count();
const video = page.video();
await context.close();
await browser.close();

const videoPath = video ? await video.path() : null;
if (!hasCeoFocus || !videoPath) {
  throw new Error('Walkthrough recording did not capture the CEO Focus panel.');
}

const finalWebm = path.join(outDir, 'ceo_focus_walkthrough_en.webm');
await fs.rm(finalWebm, { force: true });
await fs.rename(videoPath, finalWebm);

console.log(JSON.stringify({
  ok: true,
  video: finalWebm,
  subtitles: path.join(outDir, 'ceo_focus_walkthrough_en.srt'),
}, null, 2));
