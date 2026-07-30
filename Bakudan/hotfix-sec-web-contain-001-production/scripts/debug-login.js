'use strict';
const BASE = 'https://dashboard.bakudanramen.com';
const EMAIL = 'liem.dt0208@gmail.com';
const PASS = '123456';

async function main() {
  process.stdout.write('=== Debug Login ===\n');
  
  // GET the login form
  const getRes = await fetch(BASE + '/login', { signal: AbortSignal.timeout(10000) });
  const html = await getRes.text();
  process.stdout.write('GET /login HTTP ' + getRes.status + ' len=' + html.length + '\n');
  
  // Extract all form fields
  const formFields = [];
  const fieldRe = /name=["']([^"']+)["']/gi;
  let m;
  while ((m = fieldRe.exec(html)) !== null) {
    formFields.push(m[1]);
  }
  process.stdout.write('Form fields: ' + JSON.stringify(formFields) + '\n');
  
  // Extract CSRF token
  const csrfMatch = html.match(/name=["']csrf["']\s+value=["']([^"']+)["']/i);
  process.stdout.write('CSRF token: ' + (csrfMatch ? csrfMatch[1].slice(0, 20) + '...' : 'NOT FOUND') + '\n');
  
  // Extract form action
  const actionMatch = html.match(/<form[^>]*action=["']([^"']+)["']/i);
  process.stdout.write('Form action: ' + (actionMatch ? actionMatch[1] : '(default)') + '\n');
  
  // POST login
  const formData = new URLSearchParams({ email: EMAIL, password: PASS });
  if (csrfMatch) formData.append('csrf', csrfMatch[1]);
  
  process.stdout.write('\nPOST ' + BASE + '/login\n');
  process.stdout.write('Body: ' + formData.toString() + '\n');
  
  const postRes = await fetch(BASE + '/login', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': BASE + '/login',
    },
    body: formData,
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  
  const location = postRes.headers.get('location') || '';
  const setCookie = postRes.headers.get('set-cookie') || '';
  process.stdout.write('POST HTTP ' + postRes.status + '\n');
  process.stdout.write('Location: ' + location + '\n');
  process.stdout.write('Set-Cookie: ' + setCookie.slice(0, 200) + '\n');
  
  // Extract session
  const sessMatch = setCookie.match(/PHPSESSID=([^;]+)/);
  const sid = sessMatch ? sessMatch[1] : null;
  process.stdout.write('Session: ' + (sid || 'NONE') + '\n');
  
  // If redirect to something other than /login, follow it
  if (sid && location && !location.endsWith('/login')) {
    process.stdout.write('\nFollowing redirect to: ' + location + '\n');
    const redir = await fetch(location, {
      headers: { 'Cookie': 'PHPSESSID=' + sid },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    const body = await redir.text();
    const isAuth = /login|sign.?in|password|email/i.test(body);
    process.stdout.write('HTTP ' + redir.status + ' len=' + body.length + ' auth=' + isAuth + '\n');
    // Show snippet
    const idx = body.indexOf('<title>');
    if (idx > -1) process.stdout.write('Title: ' + body.slice(idx, idx + 100) + '\n');
  }
  
  // Even if redirect to /login, check what the response says
  if (sid) {
    process.stdout.write('\nChecking dashboard with session...\n');
    const dashRes = await fetch(BASE + '/dashboard', {
      headers: { 'Cookie': 'PHPSESSID=' + sid },
      signal: AbortSignal.timeout(10000),
    });
    const dashHtml = await dashRes.text();
    const isAuth = /login|sign.?in|password|email|invalid/i.test(dashHtml);
    process.stdout.write('dashboard HTTP ' + dashRes.status + ' len=' + dashHtml.length + ' auth=' + isAuth + '\n');
    const idx = dashHtml.indexOf('<title>');
    if (idx > -1) process.stdout.write('Title: ' + dashHtml.slice(idx, idx + 100) + '\n');
    
    // Look for error messages
    const errorMatch = dashHtml.match(/class=["'][^"']*error[^"']*["'][^>]*>([^<]+)/i);
    const flashMatch = dashHtml.match(/flash[^>]*>([^<]+)/i);
    process.stdout.write('Error: ' + (errorMatch ? errorMatch[1] : 'none') + '\n');
    process.stdout.write('Flash: ' + (flashMatch ? flashMatch[1] : 'none') + '\n');
  }
  
  process.stdout.write('\n=== Done ===\n');
}

main().then(() => process.exit(0)).catch(e => {
  process.stdout.write('FATAL: ' + e.message + '\n');
  process.exit(1);
});