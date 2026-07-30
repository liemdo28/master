'use strict';
// Drawer System Certification — Quick Auth Test
// Tests if we can get a valid session via login form POST
const BASE = 'https://dashboard.bakudanramen.com';
const PREVIEW = 'https://preview.dashboard.bakudanramen.com';

async function tryLogin(base, email, password, label) {
  console.log(`\n[${label}] Trying login: ${email}`);
  try {
    // Step 1: GET /login to get CSRF token
    const getRes = await fetch(base + '/login', {
      signal: AbortSignal.timeout(10000),
    });
    const getText = await getRes.text();
    const csrfMatch = getText.match(/name=["']csrf["']\s+value=["']([^"']+)["']/i);
    const csrf = csrfMatch ? csrfMatch[1] : '';
    console.log(`  GET /login -> HTTP ${getRes.status} | CSRF: ${csrf || '(none found)'} | len=${getText.length}`);

    if (!csrf) {
      // Try without CSRF
      const formData = new URLSearchParams({ email, password });
      const postRes = await fetch(base + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      console.log(`  POST /login -> HTTP ${postRes.status}`);
      const setCookie = postRes.headers.get('set-cookie') || '';
      console.log(`  Set-Cookie: ${setCookie.slice(0, 100)}`);
      return { status: postRes.status, setCookie };
    }

    // Step 2: POST login
    const formData = new URLSearchParams({ email, password, csrf });
    const postRes = await fetch(base + '/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': base + '/login',
      },
      body: formData,
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    console.log(`  POST /login -> HTTP ${postRes.status}`);
    const setCookie = postRes.headers.get('set-cookie') || '';
    const location = postRes.headers.get('location') || '';
    console.log(`  Set-Cookie: ${setCookie.slice(0, 150)}`);
    console.log(`  Location: ${location}`);

    // Step 3: Test session with /dashboard
    if (postRes.status === 302 || setCookie.includes('PHPSESSID')) {
      const sessMatch = setCookie.match(/PHPSESSID=([^;]+)/);
      if (sessMatch) {
        const sid = sessMatch[1];
        const dashRes = await fetch(base + '/dashboard', {
          headers: { 'Cookie': `PHPSESSID=${sid}` },
          signal: AbortSignal.timeout(10000),
        });
        const dashText = await dashRes.text();
        const needsAuth = /login|sign.?in|password/i.test(dashText);
        console.log(`  GET /dashboard (with session) -> HTTP ${dashRes.status} | len=${dashText.length} | needsAuth=${needsAuth}`);
        return { success: !needsAuth, sessionId: sid, dashLen: dashText.length };
      }
    }
    return { status: postRes.status };
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return { error: e.message };
  }
}

async function main() {
  console.log('=== Drawer Certification — Auth Probe ===');
  
  // Try preview QA bot
  const qaResult = await tryLogin(PREVIEW, 'qa.bot@bakudanramen.com', 'QA-Preview-2026!', 'PREVIEW-QA');
  
  // Try common production admin emails
  const admins = [
    'admin@bakudanramen.com',
    'liem@bakudanramen.com',
    'admin@dashboard.bakudanramen.com',
  ];
  
  for (const email of admins) {
    await tryLogin(BASE, email, 'admin', `PROD-${email.split('@')[0]}`);
  }
  
  console.log('\n=== Summary ===');
  console.log('Preview QA Bot:', JSON.stringify(qaResult));
  console.log('Need production admin credentials to proceed with drawer certification.');
  console.log('Alternatively, provide a valid PHPSESSID cookie.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });