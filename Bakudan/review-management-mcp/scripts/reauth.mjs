#!/usr/bin/env node
/**
 * reauth.mjs — One-time Google OAuth setup to get a refresh token.
 *
 * Run this ONCE from Terminal to authorize and get credentials.
 * After this, everything runs headless forever (until you change your Google password).
 *
 * Usage:
 *   node scripts/reauth.mjs
 *
 * Steps:
 *   1. Starts a local server on port 8080
 *   2. Opens (or prints) the Google auth URL
 *   3. Catches the redirect automatically
 *   4. Exchanges code for refresh token
 *   5. Patches your .env file
 *
 * PREREQUISITE — add this redirect URI in Google Cloud Console ONCE:
 *   http://localhost:8080
 *   Console → APIs & Services → Credentials → your OAuth Client ID → Edit
 *   → Authorized redirect URIs → Add URI → Save
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

let CLIENT_ID = "";
let CLIENT_SECRET = "";

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "GOOGLE_CLIENT_ID") CLIENT_ID = val;
    if (key === "GOOGLE_CLIENT_SECRET") CLIENT_SECRET = val;
  }
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Could not read GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET from .env");
  console.error(`   Looking for .env at: ${envPath}`);
  process.exit(1);
}

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = "https://www.googleapis.com/auth/business.manage";

function buildAuthUrl() {
  return (
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
    })
  );
}

function exchangeCode(code) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      }).toString()
    );

    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": body.length,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve(JSON.parse(raw)));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("\n=== Google OAuth Re-Authorization ===\n");

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h2>❌ Auth failed: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`Auth denied: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<h2>✅ Authorization successful!</h2><p>You can close this browser tab and return to Terminal.</p>`
        );
        server.close();
        resolve(code);
      }
    });

    server.listen(PORT, () => {
      const authUrl = buildAuthUrl();
      console.log("Step 1: Open this URL in your browser to sign in with Google:\n");
      console.log("  " + authUrl);
      console.log(`\nWaiting for Google to redirect to localhost:${PORT}…\n`);

      try {
        // Windows
        execSync(`start "" "${authUrl}"`, { stdio: "ignore" });
        console.log("(Browser should open automatically — if not, copy the URL above)\n");
      } catch {
        try {
          // macOS
          execSync(`open "${authUrl}"`, { stdio: "ignore" });
        } catch {
          // user can open manually
        }
      }
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use. Kill the process using it and retry.`);
      }
      reject(err);
    });
  });

  console.log("\nStep 2: Exchanging auth code for tokens…");
  const tokens = await exchangeCode(code);

  if (tokens.error) {
    console.error("❌ Token exchange failed:", tokens.error, tokens.error_description);
    process.exit(1);
  }

  console.log("✅ Tokens received!\n");
  console.log(`  Refresh token: ${tokens.refresh_token}`);
  console.log(`  Access token expires in: ${tokens.expires_in}s\n`);

  if (!tokens.refresh_token) {
    console.warn(
      "⚠️  No refresh_token returned. This can happen if you already authorized this app.\n" +
        "   Go to https://myaccount.google.com/permissions, revoke access for your app,\n" +
        "   then run reauth.mjs again."
    );
    process.exit(1);
  }

  // Patch .env
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf-8");
    if (env.includes("GOOGLE_REFRESH_TOKEN=")) {
      env = env.replace(/^GOOGLE_REFRESH_TOKEN=.*/m, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      env += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    }
    fs.writeFileSync(envPath, env);
    console.log("✅ .env patched with new GOOGLE_REFRESH_TOKEN\n");
  } else {
    console.log(`Add this to your .env:\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  }

  console.log("Setup complete. Run node scripts/test-connection.mjs to verify.\n");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
