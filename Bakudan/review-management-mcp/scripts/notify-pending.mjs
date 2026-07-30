#!/usr/bin/env node
/**
 * notify-pending.mjs — Manager email notifier for 1-3★ pending reviews.
 *
 * Called automatically by auto-respond.sh after each Claude run.
 * Can also be run standalone: node scripts/notify-pending.mjs
 *
 * Per run:
 *   1. Reads pending-reviews.json
 *   2. Checks Google API — marks resolved if a reply now exists
 *   3. Sends INITIAL email for new pending reviews not yet notified
 *   4. Sends REMINDER email for reviews still unresolved past REMINDER_DAYS
 *   5. Saves updated pending-reviews.json
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.dirname(__dirname);
const ENV_FILE = path.join(PROJECT_DIR, ".env");
const PENDING_JSON = path.join(PROJECT_DIR, "logs", "pending-reviews.json");

// ─── Load .env ────────────────────────────────────────────────────────────────

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1 || line.trim().startsWith("#")) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadEnv(ENV_FILE);

const REMINDER_DAYS = parseInt(process.env.REMINDER_DAYS || "2", 10);

const LOCATION_EMAILS = {
  "raw-sushi-stockton": process.env.MANAGER_EMAIL_RAW_SUSHI_STOCKTON || "",
  "bakudan-bandera": process.env.MANAGER_EMAIL_BAKUDAN_BANDERA || "",
  "bakudan-rim": process.env.MANAGER_EMAIL_BAKUDAN_RIM || "",
  "bakudan-stone-oak": process.env.MANAGER_EMAIL_BAKUDAN_STONE_OAK || "",
};

// ─── Google OAuth helpers ─────────────────────────────────────────────────────

let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
    grant_type: "refresh_token",
  }).toString();

  const data = await httpsPost("oauth2.googleapis.com", "/token", body);
  if (data.error) throw new Error(`OAuth refresh failed: ${data.error} — ${data.error_description}`);

  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000 - 60_000;
  return _cachedToken;
}

function httpsPost(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body);
    const req = https.request(
      {
        hostname,
        path: urlPath,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": buf.length,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve(JSON.parse(raw)));
      }
    );
    req.on("error", reject);
    req.write(buf);
    req.end();
  });
}

function httpsGet(hostname, urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path: urlPath,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve(JSON.parse(raw)));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function getResolvedReviewIds(accountId, locationId) {
  try {
    const token = await getAccessToken();
    const data = await httpsGet(
      "mybusiness.googleapis.com",
      `/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=50`,
      token
    );
    const resolved = new Set();
    for (const r of data.reviews || []) {
      if (r.reviewReply) resolved.add(r.reviewId ?? r.name?.split("/").pop());
    }
    return resolved;
  } catch (err) {
    console.warn(`  ⚠️  Could not check Google for resolved reviews: ${err.message}`);
    return new Set();
  }
}

// ─── Email helpers ────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

const STAR_COLOR = { 1: "#c62828", 2: "#e65100", 3: "#f9a825" };
const STAR_LABEL = { 1: "1★ — Very Negative", 2: "2★ — Negative", 3: "3★ — Mixed" };

function buildEmailHtml({ entry, isReminder }) {
  const color = STAR_COLOR[entry.stars] || "#555";
  const starLabel = STAR_LABEL[entry.stars] || `${entry.stars}★`;
  const daysPending = Math.floor((Date.now() - new Date(entry.added_at).getTime()) / 86_400_000);
  const gbpUrl = "https://business.google.com/reviews";

  const reminderBanner = isReminder
    ? `<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin-bottom:16px;border-radius:4px;">
        <strong>⏰ Reminder — ${daysPending} day${daysPending !== 1 ? "s" : ""} without a response</strong><br>
        <span style="color:#555;font-size:13px;">This review has been waiting since ${entry.review_date}. Please respond as soon as possible.</span>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.12);">
  <div style="background:${color};padding:20px 24px;color:#fff;">
    <div style="font-size:13px;opacity:.85;margin-bottom:4px;">ACTION REQUIRED — ${entry.location_name}</div>
    <h2 style="margin:0;font-size:20px;">${starLabel} Review Needs Your Response</h2>
    <div style="font-size:13px;margin-top:6px;opacity:.9;">
      From: <strong>${entry.reviewer_name}</strong> &nbsp;·&nbsp; Posted: ${entry.review_date}
    </div>
  </div>
  <div style="padding:24px;">
    ${reminderBanner}
    <div style="background:#fff5f5;border-left:4px solid ${color};padding:14px 16px;border-radius:4px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:bold;color:${color};margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Customer Review</div>
      <div style="color:#333;line-height:1.6;">${entry.review_text || "(no review text)"}</div>
    </div>
    <div style="background:#f0f7ff;border-left:4px solid #1976d2;padding:14px 16px;border-radius:4px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:bold;color:#1976d2;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Suggested Response (edit before posting)</div>
      <div style="color:#333;line-height:1.6;font-style:italic;">"${entry.draft_response}"</div>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${gbpUrl}" style="display:inline-block;background:#1976d2;color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
        Respond on Google Business Profile ↗
      </a>
    </div>
    <div style="background:#f9f9f9;border-radius:4px;padding:14px 16px;font-size:13px;color:#555;line-height:1.6;">
      <strong>How to respond:</strong><br>
      1. Click the button above to open Google Business Profile<br>
      2. Find this review and click <em>Reply</em><br>
      3. Paste the suggested response above (or write your own)<br>
      4. Click <em>Post reply</em>
    </div>
  </div>
  <div style="background:#f4f4f4;padding:12px 24px;font-size:11px;color:#888;text-align:center;">
    Automated alert from Review Management System &nbsp;·&nbsp; Please respond within ${REMINDER_DAYS} business day${REMINDER_DAYS !== 1 ? "s" : ""}
  </div>
</div>
</body></html>`;
}

async function sendEmail(transporter, { to, subject, html }) {
  const from = process.env.NOTIFY_FROM || process.env.SMTP_USER;
  const cc = process.env.NOTIFY_CC || undefined;
  await transporter.sendMail({ from, to, cc, subject, html });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[notify-pending] Starting — ${new Date().toISOString()}`);

  if (!fs.existsSync(PENDING_JSON)) {
    console.log("[notify-pending] No pending-reviews.json found — nothing to do.");
    return;
  }

  let store;
  try {
    store = JSON.parse(fs.readFileSync(PENDING_JSON, "utf-8"));
  } catch (err) {
    console.error("[notify-pending] Failed to parse pending-reviews.json:", err.message);
    return;
  }

  const pending = (store.pending || []).filter((r) => !r.resolved_at);
  if (pending.length === 0) {
    console.log("[notify-pending] No unresolved pending reviews — nothing to do.");
    return;
  }

  console.log(`[notify-pending] Found ${pending.length} unresolved review(s).`);

  const accountId = process.env.GOOGLE_ACCOUNT_ID || "";
  const locationMap = {
    "raw-sushi-stockton": process.env.GOOGLE_LOCATION_ID_RAW_SUSHI_STOCKTON || "",
    "bakudan-bandera": process.env.GOOGLE_LOCATION_ID_BAKUDAN_BANDERA || "",
    "bakudan-rim": process.env.GOOGLE_LOCATION_ID_BAKUDAN_RIM || "",
    "bakudan-stone-oak": process.env.GOOGLE_LOCATION_ID_BAKUDAN_STONE_OAK || "",
  };

  // Check Google for resolved reviews
  const resolvedCache = {};
  const locationKeys = [...new Set(pending.map((r) => r.location_key))];
  for (const locKey of locationKeys) {
    const locId = locationMap[locKey];
    if (locId && accountId) {
      console.log(`[notify-pending] Checking Google for resolved reviews at ${locKey}…`);
      resolvedCache[locKey] = await getResolvedReviewIds(accountId, locId);
    } else {
      resolvedCache[locKey] = new Set();
    }
  }

  // Mark resolved
  let resolvedCount = 0;
  for (const entry of store.pending) {
    if (entry.resolved_at) continue;
    if (resolvedCache[entry.location_key]?.has(entry.review_id)) {
      entry.resolved_at = new Date().toISOString();
      resolvedCount++;
      console.log(`[notify-pending] ✅ Resolved: ${entry.reviewer_name} (${entry.stars}★) at ${entry.location_name}`);
    }
  }

  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  let transporter = null;
  if (smtpConfigured) {
    transporter = createTransport();
  } else {
    console.warn("[notify-pending] ⚠️  SMTP not configured — skipping emails.");
  }

  const now = new Date();
  let initialCount = 0;
  let reminderCount = 0;
  let skippedNoEmail = 0;

  for (const entry of store.pending) {
    if (entry.resolved_at) continue;

    const toEmails = LOCATION_EMAILS[entry.location_key];
    if (!toEmails) {
      skippedNoEmail++;
      continue;
    }

    const lastNotified = entry.last_reminded_at || entry.first_notified_at;
    const daysSinceLast = lastNotified
      ? (now - new Date(lastNotified)) / 86_400_000
      : Infinity;

    const isNew = !entry.first_notified_at;
    const isOverdue = !isNew && daysSinceLast >= REMINDER_DAYS;

    if (!isNew && !isOverdue) continue;
    if (!transporter) continue;

    const isReminder = !isNew;
    const daysPending = Math.floor((now - new Date(entry.added_at)) / 86_400_000);
    const subject = isReminder
      ? `🔁 Reminder (${daysPending}d): ${entry.stars}★ review still needs response — ${entry.location_name}`
      : `⚠️ New ${entry.stars}★ review needs your response — ${entry.location_name}`;

    try {
      await sendEmail(transporter, {
        to: toEmails,
        subject,
        html: buildEmailHtml({ entry, isReminder }),
      });

      const ts = new Date().toISOString();
      if (isNew) {
        entry.first_notified_at = ts;
        initialCount++;
        console.log(`[notify-pending] 📧 Initial email sent for ${entry.reviewer_name} → ${toEmails}`);
      } else {
        entry.last_reminded_at = ts;
        entry.reminder_count = (entry.reminder_count || 0) + 1;
        reminderCount++;
        console.log(`[notify-pending] 🔁 Reminder #${entry.reminder_count} sent for ${entry.reviewer_name} → ${toEmails}`);
      }
    } catch (err) {
      console.error(`[notify-pending] ❌ Email failed for ${entry.reviewer_name}: ${err.message}`);
    }
  }

  store.last_updated = new Date().toISOString();
  fs.writeFileSync(PENDING_JSON, JSON.stringify(store, null, 2));

  console.log(
    `[notify-pending] Done — resolved: ${resolvedCount} | initial emails: ${initialCount} | reminders: ${reminderCount} | skipped (no email): ${skippedNoEmail}`
  );
}

main().catch((err) => {
  console.error("[notify-pending] Fatal:", err.message);
  process.exit(1);
});
