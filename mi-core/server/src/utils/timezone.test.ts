/**
 * Timezone Architecture — Test Cases
 * Validates OWNER_TIMEZONE_PRIMARY architecture.
 *
 * Run: npx tsx src/utils/timezone.test.ts
 */

import { getAllClocks, getOwnerTimezone, getTimeContextForAI, getOwnerDateInfo, STORE_TIMEZONES } from './timezone';

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${label}`);
  }
}

function fmtTime(t: Date, tz: string, label: string) {
  const s = t.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const [hh, mm] = s.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${String(h12).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${period} ${label}`;
}

// ── TEST CASE: CEO in Vietnam at 19:00 ─────────────────────────────────────
// Verified with Node.js Intl:
// Vietnam 19:00 = Chicago 07:00 CDT = LA 05:00 PDT (CDT is UTC-5, PDT is UTC-7)
const VIETNAM_1900 = new Date('2026-06-09T19:00:00+07:00');
// UTC+7 → UTC-5 = 12h behind for Chicago
// UTC+7 → UTC-7 = 14h behind for LA

console.log('\n=== TEST CASE: Vietnam 19:00 ICT (2026-06-09) ===');
console.log(`Vietnam:    ${fmtTime(VIETNAM_1900, 'Asia/Ho_Chi_Minh', 'ICT')}`);
console.log(`Bakudan:    ${fmtTime(VIETNAM_1900, 'America/Chicago', 'CDT')}`);
console.log(`Raw Sushi:  ${fmtTime(VIETNAM_1900, 'America/Los_Angeles', 'PDT')}`);

// Correct expected values (UTC offset math):
// Vietnam 19:00 UTC+7 → Chicago 07:00 CDT (UTC-5) | LA 05:00 PDT (UTC-7)
assert(fmtTime(VIETNAM_1900, 'Asia/Ho_Chi_Minh', 'ICT').includes('07:00 PM ICT'), 'Vietnam 19:00 = 07:00 PM ICT');
assert(fmtTime(VIETNAM_1900, 'America/Chicago', 'CDT').includes('07:00 AM CDT'), 'Vietnam 19:00 = 07:00 AM CDT (UTC+7 → UTC-5 = -12h)');
assert(fmtTime(VIETNAM_1900, 'America/Los_Angeles', 'PDT').includes('05:00 AM PDT'), 'Vietnam 19:00 = 05:00 AM PDT (UTC+7 → UTC-7 = -14h)');

// ── TEST CASE: Owner timezone is Ho Chi Minh ──────────────────────────────
console.log('\n=== OWNER TIMEZONE CONFIG ===');
const ownerTz = getOwnerTimezone();
assert(ownerTz === 'Asia/Ho_Chi_Minh', `Owner timezone is Asia/Ho_Chi_Minh (got: ${ownerTz})`);

// ── TEST CASE: getAllClocks returns correct structure ─────────────────────
const clocks = getAllClocks();
assert(clocks.owner.tzCode === 'ICT', `Owner tzCode is ICT (got: ${clocks.owner.tzCode})`);
assert(clocks.stores['Bakudan Ramen'].tzCode === 'CDT/CST', `Bakudan tzCode is CDT/CST (got: ${clocks.stores['Bakudan Ramen'].tzCode})`);
assert(clocks.stores['Raw Sushi Bar'].tzCode === 'PDT/PST', `Raw Sushi tzCode is PDT/PST (got: ${clocks.stores['Raw Sushi Bar'].tzCode})`);

// ── TEST CASE: Store timezone mappings ────────────────────────────────────
assert(STORE_TIMEZONES['Bakudan Ramen'].timezone === 'America/Chicago', 'Bakudan Ramen → America/Chicago');
assert(STORE_TIMEZONES['Raw Sushi Bar'].timezone === 'America/Los_Angeles', 'Raw Sushi Bar → America/Los_Angeles');

// ── TEST CASE: getTimeContextForAI includes owner primary ─────────────────
const ctx = getTimeContextForAI();
assert(ctx.includes('Owner timezone PRIMARY'), 'getTimeContextForAI includes OWNER PRIMARY marker');
assert(ctx.includes('Asia/Ho_Chi_Minh'), 'getTimeContextForAI includes Asia/Ho_Chi_Minh');
assert(ctx.includes('Bakudan Ramen'), 'getTimeContextForAI includes Bakudan Ramen');
assert(ctx.includes('Raw Sushi Bar'), 'getTimeContextForAI includes Raw Sushi Bar');

// ── TEST CASE: Relative date helpers (owner timezone) ─────────────────────
const dateInfo = getOwnerDateInfo();
assert(dateInfo.today !== undefined, 'getOwnerDateInfo returns today');
assert(dateInfo.tomorrow !== undefined, 'getOwnerDateInfo returns tomorrow');
assert(['morning', 'afternoon', 'evening', 'night'].includes(dateInfo.timeOfDay), 'getOwnerDateInfo returns valid timeOfDay');

// ── TEST CASE: Chat "today" behavior ──────────────────────────────────────
// When CEO says "today" at Vietnam 19:00 ICT → today = 2026-06-09
// "today" in Vietnam = 2026-06-09 — use as primary (NOT Chicago or LA)
assert(dateInfo.today === '2026-06-09', `Vietnam "today" = 2026-06-09 (got: ${dateInfo.today})`);

// ── TEST CASE: AI context injection has timezone rule ────────────────────
const timeContext = getTimeContextForAI();
const tzKeywords = ['today', 'tomorrow', 'this week', 'morning', 'afternoon', 'evening', 'schedule', 'reminder'];
for (const kw of tzKeywords) {
  assert(timeContext.toLowerCase().includes(kw), `Time context includes "${kw}" behavior`);
}

// ── FINAL RESULT ──────────────────────────────────────────────────────────
console.log('\n=== TIMEZONE ARCHITECTURE — TEST RESULTS ===');
if (!process.exitCode) {
  console.log('✅ ALL TESTS PASSED');
  console.log('OWNER_TIMEZONE_PRIMARY: PASS');
  console.log('Vietnam 19:00 ICT → Header: 07:00 PM ICT ✅');
  console.log('Bakudan Ramen → 07:00 AM CDT ✅ (UTC+7→UTC-5 = -12h)');
  console.log('Raw Sushi Bar → 05:00 AM PDT ✅ (UTC+7→UTC-7 = -14h)');
  console.log('Chat "What should I do today?" → Vietnam date/time ✅');
} else {
  console.log('❌ SOME TESTS FAILED — check output above');
}