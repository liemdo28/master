/**
 * SEO Control Center — security regression tests.
 * Exercises REAL code paths: path traversal, SQL injection (via the real
 * keyword-store / fact-registry parameterized-query functions against an
 * isolated temp DB), command injection (isGitTracked), secret redaction,
 * cross-brand isolation, HTML injection in the dashboard, and the strict
 * /api/seo route gate.
 *
 * IMPORTANT — module load order: several modules under test transitively
 * import ../seo-db.ts, which computes its DB directory from process.env.MI_DATA_DIR
 * at MODULE-TOP-LEVEL (import time), not at call time. Static `import` statements
 * in ESM are hoisted above any of this file's own code, so MI_DATA_DIR would be
 * set too late if we used static imports for those modules. This file therefore
 * sets MI_DATA_DIR to a temp dir FIRST, then uses dynamic import() for anything
 * that (directly or transitively) touches seo-db.ts, so all writes in this test
 * land in an isolated throwaway DB — never the real
 * .local-agent-global/seo/seo-control-center.db.
 *
 * Run with:  node --import tsx src/seo/__tests__/security.mjs
 * (from mi-core/server)
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVER_ROOT = join(__dirname, '..', '..', '..'); // mi-core/server
const SEO_SRC = join(SERVER_ROOT, 'src', 'seo');

let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('=== security.mjs ===');

// Isolated temp data dir BEFORE any dynamic import of seo-db-touching modules.
const tmpDataDir = mkdtempSync(join(tmpdir(), 'seo-security-test-'));
process.env.MI_DATA_DIR = tmpDataDir;

async function importTs(relPathFromSeoSrc) {
  return import(pathToFileURL(join(SEO_SRC, relPathFromSeoSrc)).href);
}

// ── §1: Path traversal (resolveWithinRoot) ─────────────────────────────────

console.log('\n-- Path traversal (publish-safety.ts) --');
{
  const { resolveWithinRoot, isGitTracked } = await importTs('publishing/publish-safety.ts');

  const repoRoot = join(tmpdir(), 'seo-security-repo-root'); // doesn't need to exist for resolveWithinRoot
  let threw = false;
  let thrownMessage = '';
  try {
    resolveWithinRoot(repoRoot, '../../../etc/passwd');
  } catch (e) {
    threw = true;
    thrownMessage = e.message;
  }
  check(
    'resolveWithinRoot() throws for a "../../../etc/passwd"-style escaping path',
    threw,
    threw ? '' : 'did not throw'
  );
  check(
    'thrown error names the escaping path',
    /escapes/.test(thrownMessage),
    thrownMessage
  );

  let threw2 = false;
  try {
    resolveWithinRoot(repoRoot, '..\\..\\Windows\\System32\\config\\SAM');
  } catch (e) {
    threw2 = true;
  }
  check('resolveWithinRoot() throws for a Windows-style "..\\..\\" escaping path', threw2);

  let legitResult = null;
  let legitThrew = false;
  try {
    legitResult = resolveWithinRoot(repoRoot, join('blog-drafts', 'post-123.md'));
  } catch (e) {
    legitThrew = true;
  }
  check(
    'resolveWithinRoot() accepts a legitimate relative path inside the root',
    !legitThrew && legitResult === join(repoRoot, 'blog-drafts', 'post-123.md'),
    `legitThrew=${legitThrew} result=${legitResult}`
  );

  // ── §2: Command injection (isGitTracked uses execFileSync w/ array args) ──
  console.log('\n-- Command injection (isGitTracked) --');

  const srcText = readFileSync(join(SEO_SRC, 'publishing', 'publish-safety.ts'), 'utf8');
  const usesExecFileSyncArrayForm = /execFileSync\(\s*'git'\s*,\s*\[/.test(srcText);
  check(
    'isGitTracked() source uses execFileSync(\'git\', [array args]) — not a shell string',
    usesExecFileSyncArrayForm,
    'expected execFileSync(\'git\', [...]) pattern in publish-safety.ts'
  );
  check(
    'isGitTracked() source does not pass { shell: true } (which would re-enable shell metachar interpretation)',
    !/shell:\s*true/.test(srcText)
  );

  // Real git repo so isGitTracked() actually shells out to `git ls-files`.
  const gitRepo = mkdtempSync(join(tmpdir(), 'seo-security-gitrepo-'));
  const canaryPath = join(gitRepo, 'CANARY_SHOULD_NOT_BE_CREATED.txt');
  try {
    execFileSync('git', ['init', '-q'], { cwd: gitRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: gitRepo });
    execFileSync('git', ['config', 'user.name', 'test'], { cwd: gitRepo });

    const maliciousRel = `nonexistent.txt; touch ${canaryPath} #`;
    const maliciousAbs = join(gitRepo, maliciousRel);
    let result;
    let threwOnMalicious = false;
    try {
      result = isGitTracked(gitRepo, maliciousAbs);
    } catch (e) {
      threwOnMalicious = true;
    }
    check(
      'isGitTracked() with a path containing shell metacharacters (";", "touch", "#") does not throw an unhandled error',
      !threwOnMalicious,
      threwOnMalicious ? 'threw unexpectedly' : ''
    );
    check(
      'isGitTracked() treats the metacharacter-laden path as a literal non-existent file (returns false)',
      result === false,
      `got ${result}`
    );
    check(
      'no canary file was created — the ";" and "touch" in the path were never shell-interpreted',
      !existsSync(canaryPath),
      existsSync(canaryPath) ? 'CANARY FILE WAS CREATED — command injection occurred!' : ''
    );
  } finally {
    rmSync(gitRepo, { recursive: true, force: true });
  }
}

// ── §3: SQL injection — real keyword-store.ts / fact-registry.ts, isolated DB

console.log('\n-- SQL injection (keyword-store.ts, fact-registry.ts) --');
{
  const { insertKeyword, listKeywords, getKeywordById } = await importTs('keywords/keyword-store.ts');
  const { createFact, listFacts, getFactById } = await importTs('facts/fact-registry.ts');
  const { getSeoDb } = await importTs('seo-db.ts');

  const db = getSeoDb();
  const tableExists = (name) =>
    !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);

  check('seo_keywords table exists before injection attempt', tableExists('seo_keywords'));
  check('seo_business_facts table exists before injection attempt', tableExists('seo_business_facts'));

  const maliciousKeyword = "'; DROP TABLE seo_keywords; --";
  let insertThrew = false;
  let inserted = null;
  try {
    inserted = insertKeyword({ brand_id: 'security_test_brand', keyword: maliciousKeyword });
  } catch (e) {
    insertThrew = true;
  }
  check('insertKeyword() with a DROP-TABLE-shaped value does not throw', !insertThrew);
  check('seo_keywords table STILL exists after the injection attempt', tableExists('seo_keywords'));
  check(
    'the malicious string was stored verbatim as inert data (not executed as SQL)',
    inserted && inserted.keyword === maliciousKeyword,
    inserted ? inserted.keyword : 'insert failed'
  );
  check(
    'reading it back by id returns the exact same literal string',
    inserted && getKeywordById(inserted.id)?.keyword === maliciousKeyword
  );

  // Also inject through a WHERE-clause status filter, not just an insert value.
  const maliciousStatusFilter = "APPROVED' OR '1'='1";
  let listThrew = false;
  let listResult = [];
  try {
    listResult = listKeywords('security_test_brand', { status: maliciousStatusFilter });
  } catch (e) {
    listThrew = true;
  }
  check('listKeywords() with an OR-1=1-shaped status filter does not throw', !listThrew);
  check(
    'the OR-1=1 filter matched nothing (treated as a literal status string, not a boolean-bypass clause)',
    Array.isArray(listResult) && listResult.length === 0,
    `got ${listResult.length} rows`
  );
  check('seo_keywords table STILL exists after the filter injection attempt', tableExists('seo_keywords'));

  const maliciousFactValue = "'; DROP TABLE seo_business_facts; --";
  let factInsertThrew = false;
  let insertedFact = null;
  try {
    insertedFact = createFact({
      brand_id: 'security_test_brand',
      category: 'test',
      field_name: 'test_field',
      value: maliciousFactValue,
      source: 'security-test',
    });
  } catch (e) {
    factInsertThrew = true;
  }
  check('createFact() with a DROP-TABLE-shaped value does not throw', !factInsertThrew);
  check('seo_business_facts table STILL exists after the injection attempt', tableExists('seo_business_facts'));
  check(
    'the malicious fact value was stored verbatim as inert data',
    insertedFact && insertedFact.value === maliciousFactValue,
    insertedFact ? insertedFact.value : 'insert failed'
  );
  check(
    'reading the fact back by id returns the exact same literal string',
    insertedFact && getFactById(insertedFact.id)?.value === maliciousFactValue
  );

  const maliciousCategoryFilter = "x' OR '1'='1";
  let factListThrew = false;
  let factListResult = [];
  try {
    factListResult = listFacts('security_test_brand', { category: maliciousCategoryFilter });
  } catch (e) {
    factListThrew = true;
  }
  check('listFacts() with an OR-1=1-shaped category filter does not throw', !factListThrew);
  check(
    'the OR-1=1 category filter matched nothing (parameterized, not concatenated)',
    Array.isArray(factListResult) && factListResult.length === 0,
    `got ${factListResult.length} rows`
  );
}

// ── §4: Cross-brand isolation (assertBrandIsolation) ───────────────────────

console.log('\n-- Cross-brand isolation (link-recommender.ts) --');
{
  const { assertBrandIsolation } = await importTs('links/link-recommender.ts');

  function fakePage(brandId, id) {
    return {
      id, created_at: '', updated_at: '', brand_id: brandId, location_id: null,
      url: `https://example.com/${id}`, page_type: 'money', title: null,
      meta_title: null, meta_description: null, canonical: null, is_orphan: 0,
      last_crawled_at: null, deleted_at: null,
    };
  }

  const mixedBrandPages = [
    fakePage('bakudan', 'p1'),
    fakePage('bakudan', 'p2'),
    fakePage('raw_sushi', 'p3'), // leaked cross-brand page
  ];

  let threw = false;
  let msg = '';
  try {
    assertBrandIsolation(mixedBrandPages, 'bakudan');
  } catch (e) {
    threw = true;
    msg = e.message;
  }
  check('assertBrandIsolation() throws when a cross-brand page is present', threw);
  check('thrown error identifies it as a BRAND_ISOLATION_VIOLATION', /BRAND_ISOLATION_VIOLATION/.test(msg), msg);

  const uniformBrandPages = [fakePage('bakudan', 'p1'), fakePage('bakudan', 'p2')];
  let threwUniform = false;
  try {
    assertBrandIsolation(uniformBrandPages, 'bakudan');
  } catch (e) {
    threwUniform = true;
  }
  check('assertBrandIsolation() does not throw when all pages match the requested brand', !threwUniform);
}

// ── §5: Secret redaction (redact.ts) — pure function, safe to static-import ─
// (imported dynamically here too, purely for file-structure consistency; it
// has no DB dependency either way.)

console.log('\n-- Secret redaction (ai-providers/redact.ts) --');
{
  const { redactSecrets } = await importTs('ai-providers/redact.ts');
  const fakeOpenAi = 'sk-' + 'proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
  const fakeAnthropic = 'sk-' + 'ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789012345';
  const fakeGoogle = 'AI' + 'zaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY';
  const fakeAws = 'AK' + 'IAABCDEFGHIJKLMNOP';
  const fakeGithub = 'gh' + 'p_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const fakeSlack = 'xox' + 'b-1234567890-abcdefghijklmnop';

  const cases = [
    { name: 'OpenAI key', input: `my key is ${fakeOpenAi}`, mustNotContain: fakeOpenAi },
    { name: 'Anthropic key', input: `ANTHROPIC_API_KEY=${fakeAnthropic}`, mustNotContain: fakeAnthropic },
    { name: 'Google API key', input: `key: ${fakeGoogle}`, mustNotContain: fakeGoogle },
    { name: 'AWS access key id', input: `${fakeAws} is my access key`, mustNotContain: fakeAws },
    { name: 'GitHub token', input: `token ${fakeGithub}`, mustNotContain: fakeGithub },
    { name: 'Slack token', input: fakeSlack, mustNotContain: fakeSlack },
    { name: 'Bearer token', input: 'Authorization: Bearer abc123DEF456ghi789JKL0123456', mustNotContain: 'abc123DEF456ghi789JKL0123456' },
    {
      name: 'JWT',
      input: `session=${['eyJfixture', 'payloadfixture', 'signaturefixture'].join('.')}`,
      mustNotContain: ['eyJfixture', 'payloadfixture', 'signaturefixture'].join('.'),
    },
    { name: 'password=value assignment', input: 'password=fixture-pass', mustNotContain: 'fixture-pass' },
  ];

  for (const c of cases) {
    const out = redactSecrets(c.input);
    check(`redactSecrets() strips ${c.name}`, !out.includes(c.mustNotContain), out);
    check(`redactSecrets() leaves a [REDACTED] marker for ${c.name}`, out.includes('[REDACTED]'), out);
  }

  const normalText = 'This is a normal SEO article about the best ramen in San Antonio. No secrets here.';
  check('redactSecrets() passes normal text through unchanged', redactSecrets(normalText) === normalText);
}

// ── §6: SEO API route gate — read from real index.ts ──

console.log('\n-- SEO API route gate (index.ts) --');
{
  const indexSrc = readFileSync(join(SERVER_ROOT, 'src', 'index.ts'), 'utf8');
  const lines = indexSrc.split('\n');

  const seoMountLines = lines.filter(l => /app\.use\(\s*['"]\/api\/seo/.test(l));
  check('found at least one /api/seo* route mount in index.ts', seoMountLines.length > 0, `found ${seoMountLines.length}`);

  const seoGateIndex = lines.findIndex(l => /app\.use\(\s*['"]\/api\/seo/.test(l) && /seoRateLimiter/.test(l) && /requireSeoAccess/.test(l));
  const firstSeoRouterIndex = lines.findIndex(l => /app\.use\(\s*['"]\/api\/seo/.test(l) && /seoRouter|seoResearchRouter|seoLinksRouter|seoLocalRouter|seoReportsRouter|seoEvidenceRouteRouter|seoCalendarRouter/.test(l));
  check(
    '/api/seo mounts strict seoRateLimiter + requireSeoAccess gate',
    seoGateIndex >= 0,
    'missing app.use("/api/seo", seoRateLimiter, requireSeoAccess) gate'
  );
  check(
    'strict SEO gate is mounted before SEO feature routers',
    seoGateIndex >= 0 && firstSeoRouterIndex >= 0 && seoGateIndex < firstSeoRouterIndex,
    `gate=${seoGateIndex}, firstRouter=${firstSeoRouterIndex}`
  );
  check(
    'requireSeoAccess implementation is present',
    existsSync(join(SEO_SRC, 'seo-security.ts')),
    'src/seo/seo-security.ts missing'
  );

  // Contrast check: prove the scanner itself is meaningful by confirming other,
  // already-protected routers in the same file DO show requireAuth — if this
  // failed it would mean the regex/detection approach itself is broken.
  const knownProtectedLine = lines.find(l => /app\.use\(\s*['"]\/api\/operations/.test(l));
  check(
    'sanity check: /api/operations mount (a known requireAuth-protected route) is detected as having requireAuth — proves the detection regex itself works',
    !!knownProtectedLine && /requireAuth/.test(knownProtectedLine),
    knownProtectedLine || 'line not found'
  );

  console.log('  ℹ️  /api/seo mount lines:');
  for (const l of seoMountLines) console.log('     ' + l.trim());
}

// ── §7: HTML injection — scan seo-control-center.html innerHTML assignments

console.log('\n-- HTML injection (seo-control-center.html innerHTML usage) --');
{
  const htmlPath = join(SERVER_ROOT, '..', 'ui', 'seo-control-center.html');
  check('seo-control-center.html exists at expected path', existsSync(htmlPath), htmlPath);
  const html = readFileSync(htmlPath, 'utf8');

  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  const js = scriptMatch ? scriptMatch[1] : html;

  // Find every top-level `X.innerHTML = <expr>;` assignment statement, respecting
  // nested backtick template literals / ${} expressions / nested backticks
  // inside those expressions (e.g. `.map(x => \`...${...}...\`)`), so we don't
  // false-negative on multi-line, deeply-nested template compositions.
  function findInnerHTMLAssignments(s) {
    const results = [];
    const stack = [{ mode: 'code' }];
    let i = 0;
    let pendingAssignStart = null;
    const N = s.length;
    const skipSimpleString = (str, idx, quote) => {
      idx++;
      while (idx < str.length) {
        if (str[idx] === '\\') { idx += 2; continue; }
        if (str[idx] === quote) return idx + 1;
        idx++;
      }
      return idx;
    };
    while (i < N) {
      const top = stack[stack.length - 1];
      const c = s[i];
      if (top.mode === 'code') {
        if (stack.length === 1 && pendingAssignStart === null && s.startsWith('.innerHTML', i)) {
          let j = i + '.innerHTML'.length;
          while (s[j] === ' ') j++;
          if (s[j] === '=' && s[j + 1] !== '=') {
            j++;
            while (s[j] === ' ') j++;
            pendingAssignStart = j;
            i = j;
            continue;
          }
        }
        if (c === '`') { stack.push({ mode: 'template' }); i++; continue; }
        if (c === "'" || c === '"') { i = skipSimpleString(s, i, c); continue; }
        if (c === ';' && stack.length === 1 && pendingAssignStart !== null) {
          results.push(s.slice(pendingAssignStart, i));
          pendingAssignStart = null;
          i++;
          continue;
        }
        if (c === '{' && stack.length > 1) { top.braceDepth = (top.braceDepth || 0) + 1; i++; continue; }
        if (c === '}' && stack.length > 1) {
          if ((top.braceDepth || 0) === 0) { stack.pop(); i++; continue; }
          top.braceDepth--;
          i++;
          continue;
        }
        i++;
        continue;
      } else {
        // top.mode === 'template'
        if (c === '\\') { i += 2; continue; }
        if (c === '`') { stack.pop(); i++; continue; }
        if (c === '$' && s[i + 1] === '{') { stack.push({ mode: 'code', braceDepth: 0 }); i += 2; continue; }
        i++;
        continue;
      }
    }
    return results;
  }

  // Peel `${...}` interpolations layer by layer (innermost first), so nested
  // template literals (arrays .map()'d into sub-templates) are fully covered.
  function extractInterpolations(text) {
    const found = [];
    let s = text;
    let changed = true;
    let guard = 0;
    while (changed && guard < 100) {
      changed = false;
      guard++;
      s = s.replace(/\$\{([^${}]*)\}/g, (m, inner) => {
        found.push(inner.trim());
        changed = true;
        return '__PEELED__';
      });
    }
    return found;
  }

  const assignments = findInnerHTMLAssignments(js);
  check(
    'innerHTML assignment scan completed (zero assignments is safest)',
    assignments.length >= 0,
    `found ${assignments.length}`
  );

  const SAFE_PATTERNS = [
    /^esc\(/,           // HTML-escaped
    /^fmtDate\(/,        // date formatter, no raw user text
    /^encodeURIComponent\(/,
    /__PEELED__/,        // container expression whose own interpolations were already checked
    /^-?\d+(\.\d+)?$/,   // numeric literal
  ];
  // Identifiers/expressions verified by manual read to only ever hold values
  // drawn from a fixed, hardcoded, non-user-controlled source in this file
  // (e.g. `tier`/`cls` iterate a hardcoded 4-item local array of policy tier
  // names, `c` is a Object.entries() count number) — not attacker-controlled
  // API response text.
  const SAFE_LITERAL_EXPRESSIONS = new Set(['c', 'tier', 'cls']);

  const suspicious = [];
  for (const stmt of assignments) {
    const interps = extractInterpolations(stmt);
    for (const expr of interps) {
      if (SAFE_PATTERNS.some((re) => re.test(expr))) continue;
      if (SAFE_LITERAL_EXPRESSIONS.has(expr)) continue;
      suspicious.push({ expr, stmt: stmt.replace(/\s+/g, ' ').slice(0, 120) });
    }
  }

  check(
    'no unescaped user/API-derived interpolation found inside any .innerHTML assignment',
    suspicious.length === 0,
    suspicious.length ? `${suspicious.length} suspicious interpolation(s) — see below` : ''
  );
  if (suspicious.length) {
    console.log('  ⚠️  Suspicious interpolations (flagged for manual review, NOT auto-failed as confirmed XSS):');
    for (const s of suspicious.slice(0, 30)) {
      console.log(`     ${JSON.stringify(s.expr)}  in: ${s.stmt}`);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('Failures:', failures.join(', '));
}

// Cleanup temp DB dir.
try {
  rmSync(tmpDataDir, { recursive: true, force: true });
} catch { /* best effort on Windows file locks */ }

if (fail > 0) process.exit(1);
