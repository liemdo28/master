import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd(), '..');
const authSrc = readFileSync(join(root, 'server', 'src', 'routes', 'auth.ts'), 'utf8');
const uiSrc = readFileSync(join(root, 'ui', 'seo-control-center.html'), 'utf8');

let failed = 0;
function check(name, ok) {
  if (ok) console.log(`  PASS  ${name}`);
  else { console.log(`  FAIL  ${name}`); failed++; }
}

console.log('=== auth-url-security.mjs ===');

check('server rejects query token/csrf attempts',
  authSrc.includes('query_token_auth_rejected') && authSrc.includes('req.query.token || req.query.csrf'));

check('server token extraction is bearer-header only',
  /function extractToken[\s\S]*headers\.authorization[\s\S]*return null;[\s\S]*}/.test(authSrc) &&
  !/req\.query\.token as string/.test(authSrc));

check('dashboard never reads token/csrf values from URL into auth state',
  !/urlAuth\.get\('token'\)/.test(uiSrc) && !/urlAuth\.get\('csrf'\)/.test(uiSrc));

check('dashboard strips legacy sensitive query parameters with history.replaceState',
  uiSrc.includes("urlAuth.delete('token')") &&
  uiSrc.includes("urlAuth.delete('csrf')") &&
  uiSrc.includes('history.replaceState'));

check('dashboard stores auth in sessionStorage only, not localStorage',
  uiSrc.includes("sessionStorage.setItem('mi_auth_token'") &&
  !/localStorage\.setItem\('mi_auth_token'/.test(uiSrc) &&
  !/localStorage\.getItem\('mi_auth_token'/.test(uiSrc));

check('logout calls server-side revoke endpoint',
  uiSrc.includes("fetch('/api/auth/logout'") && uiSrc.includes('Authorization: `Bearer ${tokenToRevoke}`'));

if (failed) {
  console.error(`${failed} auth URL security check(s) failed`);
  process.exit(1);
}
console.log('6 passed, 0 failed');
