#!/usr/bin/env node
/**
 * test-connection.mjs — Verify credentials and list all locations + reviews.
 *
 * Usage:
 *   node scripts/test-connection.mjs
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

// ─── Load .env ────────────────────────────────────────────────────────────────

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1 || line.trim().startsWith("#")) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN ?? "";
const ACCOUNT_ID = process.env.GOOGLE_ACCOUNT_ID ?? "";

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("❌ Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in .env");
  process.exit(1);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function post(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body);
    const req = https.request(
      {
        hostname,
        path: urlPath,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": data.length,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve(JSON.parse(raw)));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(hostname, urlPath, token) {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Google Business Profile — Connection Test ===\n");

  // 1. Refresh access token
  console.log("1. Refreshing access token…");
  const tokenRes = await post(
    "oauth2.googleapis.com",
    "/token",
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString()
  );

  if (tokenRes.error) {
    console.error("❌ Token refresh failed:", tokenRes.error, tokenRes.error_description);
    process.exit(1);
  }
  const token = tokenRes.access_token;
  console.log("✅ Access token obtained\n");

  // 2. Verify account
  console.log("2. Checking account access…");
  const accounts = await get("mybusinessaccountmanagement.googleapis.com", "/v1/accounts", token);
  if (accounts.error) {
    console.error("❌ Account fetch failed:", JSON.stringify(accounts.error, null, 2));
    process.exit(1);
  }
  console.log(`✅ Account: ${accounts.accounts?.[0]?.accountName}\n`);

  const accountId = ACCOUNT_ID || accounts.accounts?.[0]?.name?.split("/").pop();
  if (!accountId) {
    console.error("❌ Could not determine account ID. Set GOOGLE_ACCOUNT_ID in .env");
    process.exit(1);
  }

  // 3. List all locations
  console.log("3. Listing all locations…");
  const locList = await get(
    "mybusinessbusinessinformation.googleapis.com",
    `/v1/accounts/${accountId}/locations?readMask=name,title,storefrontAddress`,
    token
  );

  if (locList.error) {
    console.warn("⚠️  Location list failed:", JSON.stringify(locList.error, null, 2));
  } else {
    const locs = locList.locations ?? [];
    console.log(`✅ Found ${locs.length} location(s):\n`);
    locs.forEach((l, i) => {
      const id = l.name?.split("/").pop() ?? "unknown";
      const sa = l.storefrontAddress;
      const street = (sa?.addressLines ?? []).join(", ");
      const city = sa?.locality ?? "";
      const state = sa?.administrativeArea ?? "";
      const full = [street, city, state].filter(Boolean).join(", ");
      console.log(`  [${i + 1}] ${l.title ?? "(no title)"}`);
      console.log(`      ID  : ${id}`);
      if (full) console.log(`      Addr: ${full}`);
    });
    console.log();
    console.log("Copy the IDs above into your .env as GOOGLE_LOCATION_ID_* variables.\n");
  }

  // 4. Fetch reviews for configured locations
  const locationVars = Object.entries(process.env)
    .filter(([k]) => k.startsWith("GOOGLE_LOCATION_ID_") && k !== "GOOGLE_ACCOUNT_ID")
    .map(([k, v]) => ({ name: k.replace("GOOGLE_LOCATION_ID_", "").toLowerCase().replace(/_/g, "-"), id: v }));

  if (locationVars.length === 0) {
    console.log("ℹ️  No GOOGLE_LOCATION_ID_* vars set yet — skipping review fetch.");
    return;
  }

  for (const loc of locationVars) {
    console.log(`4. Fetching reviews for ${loc.name}…`);
    const reviews = await get(
      "mybusiness.googleapis.com",
      `/v4/accounts/${accountId}/locations/${loc.id}/reviews`,
      token
    );

    if (reviews.error) {
      console.error(`❌ Reviews fetch failed:`, JSON.stringify(reviews.error, null, 2));
      continue;
    }

    const list = reviews.reviews ?? [];
    console.log(`✅ Found ${list.length} review(s)\n`);

    list.slice(0, 3).forEach((r, i) => {
      const stars = "⭐".repeat({ ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating] ?? 0);
      const hasReply = r.reviewReply ? "✅ replied" : "⚠️  no reply yet";
      console.log(
        `  #${i + 1} ${stars} ${r.reviewer?.displayName ?? "Anonymous"}` +
          ` (${r.createTime?.slice(0, 10)}) [${hasReply}]`
      );
      if (r.comment) console.log(`       "${r.comment.slice(0, 80)}…"`);
    });
    console.log();
  }

  console.log("=== Test complete ===\n");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
