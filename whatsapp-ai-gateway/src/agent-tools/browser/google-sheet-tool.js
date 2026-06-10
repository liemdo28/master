'use strict';
/**
 * google-sheet-tool.js
 * Browser automation for Google Sheet validation.
 */

const { newPage, captureScreenshot, isAvailable } = require('./browser-tool');
const { makeLogger } = require('../../logger');
const log = makeLogger('browser-tool');

function getSheetUrl() {
  const id = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID || '';
  if (!id) return null;
  return `https://docs.google.com/spreadsheets/d/${id}`;
}

async function openGoogleSheet() {
  if (!isAvailable()) return { ok: false, error: 'Puppeteer not available' };
  const url = getSheetUrl();
  if (!url) return { ok: false, error: 'GOOGLE_SHEETS_ID not configured' };
  try {
    const page = await newPage(url);
    await page.waitForTimeout(4000);
    const screenshot = await captureScreenshot('google-sheet', page);
    await page.close();
    return { ok: true, url, screenshot };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function verifyGoogleSheetRow(submissionId) {
  if (!isAvailable()) return { ok: false, error: 'Puppeteer not available' };
  const url = getSheetUrl();
  if (!url) return { ok: false, error: 'GOOGLE_SHEETS_ID not configured' };
  let page;
  try {
    page = await newPage(url);
    await page.waitForTimeout(5000);

    // Search for submissionId text on the page
    const found = await page.evaluate((sid) => {
      return document.body.innerText.includes(sid);
    }, submissionId).catch(() => false);

    const screenshot = await captureScreenshot(`sheet-verify-${submissionId}`, page);
    await page.close();

    return { ok: true, submissionId, found, screenshot };
  } catch (err) {
    if (page) try { await page.close(); } catch (_) {}
    return { ok: false, submissionId, error: err.message };
  }
}

module.exports = { openGoogleSheet, verifyGoogleSheetRow, getSheetUrl };
