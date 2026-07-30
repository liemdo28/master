'use strict';
const BASE = 'https://dashboard.bakudanramen.com';
const EMAIL = 'admin@bakudanramen.com';
const PASS = 'admin123';

// Manual cookie jar
const cookies = {};

function parseCookies(headers) {
  const setCookies = headers.getSetCookie ? headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const m = sc.match(/^([^=]+)=([^;]*)/);
    if (m) cookies[m[1]] = m[2];
  }
}

function cookieString() {
  return Object.entries(cookies).map(([k,v]) => k + '=' + v).join('; ');
}

async function main() {
  process.stdout.write('=== Login Debug ===\n');
  
  // Step 1: GET /login (creates session, CSRF token)
  const getRes = await fetch(BASE + '/login', { signal: AbortSignal.timeout(10000) });
  parseCookies(getRes);
  const html = await getRes.text();
  process.stdout.write('GET /login -> ' + getRes.status + ' | cookies: ' + JSON.stringify(cookies) + '\n');
  
  // Extract CSRF
  const csrfMatch = html.match(/name=["']csrf["']\s+value=["']([^"']+)["']/i);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  process.stdout.write('CSRF: ' + (csrf ? csrf.slice(0, 16) + '...' : 'NOT FOUND') + '\n');
  if (!csrf) { process.exit(1); }
  
  // Step 2: POST /login with cookies + CSRF
  const formData = new URLSearchParams({ email: EMAIL, password: PASS, csrf: csrf });
  const postRes = await fetch(BASE + '/login', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieString(),
      'Referer': BASE + '/login',
    },
    body: formData,
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  parseCookies(postRes);
  const loc = postRes.headers.get('location') || '';
  process.stdout.write('POST -> ' + postRes.status + ' | loc=' + loc + ' | cookies: ' + JSON.stringify(cookies) + '\n');
  
  // Check if login succeeded
  const sid = cookies['PHPSESSID'] || '';
  process.stdout.write('Session: ' + (sid || 'NONE') + '\n');
  
  const isLoggedIn = loc.includes('/overview') || loc.includes('/dashboard') || loc.includes('/my-tasks');
  const isFailed = loc.includes('/login');
  process.stdout.write('Login result: ' + (isLoggedIn ? 'SUCCESS' : isFailed ? 'FAILED' : 'UNKNOWN(' + loc + ')') + '\n');
  
  if (isLoggedIn || sid) {
    // Step 3: Verify session by accessing /dashboard
    process.stdout.write('\nVerifying session on /dashboard...\n');
    const dashRes = await fetch(BASE + '/dashboard', {
      headers: { 'Cookie': cookieString() },
      signal: AbortSignal.timeout(10000),
    });
    const dashHtml = await dashRes.text();
    const auth = /login|sign.?in|password|email/i.test(dashHtml);
    process.stdout.write('GET /dashboard -> ' + dashRes.status + ' | len=' + dashHtml.length + ' | auth=' + auth + '\n');
    
    if (!auth) {
      // Extract title
      const titleM = dashHtml.match(/<title>([^<]+)<\/title>/i);
      process.stdout.write('Page title: ' + (titleM ? titleM[1] : 'n/a') + '\n');
      process.stdout.write('\nSESSION_VALID=' + sid + '\n');
    }
  }
  
  process.stdout.write('\n=== Done ===\n');
}

main().then(() => process.exit(0)).catch(e => {
  process.stdout.write('FATAL: ' + e.message + '\n');
  process.exit(1);
});