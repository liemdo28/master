'use strict';
/**
 * dashboard-smoke-tool.js
 * Browser smoke tests for the local dashboard.
 */

const { newPage, captureScreenshot, isAvailable } = require('./browser-tool');
const { makeLogger } = require('../../logger');
const log = makeLogger('browser-tool');

function getDashboardUrl() {
  const port = process.env.DASHBOARD_PORT || 3210;
  return `http://localhost:${port}`;
}

async function openDashboard() {
  if (!isAvailable()) return { ok: false, error: 'Puppeteer not available' };
  const url = getDashboardUrl();
  let page;
  try {
    page = await newPage(url);
    await page.waitForTimeout(2000);
    const title   = await page.title().catch(() => '');
    const content = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => '');
    const screenshot = await captureScreenshot('dashboard', page);
    await page.close();
    return { ok: true, url, title, contentPreview: content, screenshot };
  } catch (err) {
    if (page) try { await page.close(); } catch (_) {}
    return { ok: false, url, error: err.message };
  }
}

async function verifyDashboardSubmission(submissionId) {
  if (!isAvailable()) return { ok: false, error: 'Puppeteer not available' };
  const url = `${getDashboardUrl()}/api/food-safety/status`;
  let page;
  try {
    page = await newPage(getDashboardUrl());
    await page.waitForTimeout(2000);

    const found = await page.evaluate((sid) => {
      return document.body.innerText.includes(sid);
    }, submissionId).catch(() => false);

    // Also check via API
    let apiFound = false;
    try {
      const apiRes = await page.evaluate(async (u, sid) => {
        const r = await fetch(u);
        const d = await r.json();
        return JSON.stringify(d).includes(sid);
      }, `${getDashboardUrl()}/api/food-safety/status`, submissionId);
      apiFound = !!apiRes;
    } catch (_) {}

    const screenshot = await captureScreenshot(`dashboard-submission-${submissionId}`, page);
    await page.close();
    return { ok: true, submissionId, foundOnPage: found, foundViaApi: apiFound, screenshot };
  } catch (err) {
    if (page) try { await page.close(); } catch (_) {}
    return { ok: false, submissionId, error: err.message };
  }
}

async function runSmokeSuite() {
  log.info('Running dashboard smoke suite...');
  const results = {};

  results.dashboard = await openDashboard();
  log.info('Dashboard smoke', results.dashboard);

  // Check health endpoint directly
  try {
    const http = require('http');
    await new Promise((resolve) => {
      http.get(`${getDashboardUrl()}/api/health`, { timeout: 5000 }, res => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => {
          try { results.health = { ok: true, ...JSON.parse(body) }; } catch (_) { results.health = { ok: res.statusCode === 200 }; }
          resolve();
        });
      }).on('error', err => { results.health = { ok: false, error: err.message }; resolve(); });
    });
  } catch (err) {
    results.health = { ok: false, error: err.message };
  }

  const passed = Object.values(results).filter(r => r.ok).length;
  const total  = Object.keys(results).length;
  results._summary = { passed, total, allPass: passed === total };
  return results;
}

module.exports = { openDashboard, verifyDashboardSubmission, runSmokeSuite, getDashboardUrl };
