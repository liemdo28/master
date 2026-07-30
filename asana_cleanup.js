/**
 * Asana Bulk Operations Script
 * Deletes old overdue tasks and creates new recurring tasks
 * Usage: node asana_cleanup.js
 */
const ASANA_TOKEN = '2/1176062377577683/1215527867300666:42abdedcc12014c221eb9498e797b287';
const BASE_URL = 'https://app.asana.com/api/1.0';

async function api(method, endpoint, body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${ASANA_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify({ data: body });
  const res = await fetch(`${BASE_URL}${endpoint}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── TASKS TO DELETE (all old overdue except the 2 recent ones) ──
const DELETE_IDS = [
  // Stockton - Prepayment Tax (28 copies)
  '1213623423748927','1213132424664593','1212823732252425','1212376053516879',
  '1211908394153394','1211647401541134','1211404204894765','1211019206187598',
  '1211019056369952','1210570363228067','1210349017476226','1210009614860364',
  '1209709370140954','1209420728356951','1209283840364420',
  '1213623423748948','1213132424665653','1212823732252445','1212376053516899',
  '1211908394191108','1211647401541148','1211404204920475','1211019206187610',
  '1211019056369964','1210570363228081','1210349017476240','1210009614860378',
  '1209709370162571',
  // Old recurring task copies
  '1202172022446642', // Domain - Update Daily Sale (2022)
  '1203072715650667', // JHT - Update Sale data (2022)
  '1203072815301893', // Credit Card - Update file (2022)
  '1203049017359246', // TX Franchise Tax Filing (2023)
  '1204196558678821', // Sport - Weekly report (2023)
  '1205359142606709', // pay cps with credit card (2023)
  '1205425244563996', // Packing List invoice (2023)
  '1205537047522323', // Update Cost for Invoice Bakudan (2023)
  '1205677846775429', // B1 & B2 - Ramen Premix File (2023)
  '1208919239433430', // Stockton - Daily Sale (2024)
  '1207975292612166', // Stockton - Void / Discount Log (2024)
  '1207975343227147', // Stockton - Upload Sale to Homebase (2024)
  '1208919112449534', // Book Flight
  '1208919112449534', // Bakudan LLC - Send Monthly Sale Summary (2024)
  '1208919238753580', // Report - IFT (2024)
  '1208919104561572', // Provide total for True World (2024)
  '1208177703097955', // Stockton - Void Log (2024)
  '1208919114709046', // Report Expense - B123 (2024)
  '1208486945437895', // Pay Hoang Reimbursement - IFT (2025)
  '1209218235252309', // Liem - Add flights expense (2025)
  '1206792354436540', // Franchise Tax - All Company (2025)
  '1209186282827350', // Qida Ma Spreadsheet update (2025)
  '1209734543371699', // Seng monthly (2025)
  '1209315454072743', // JHT - Send Quarterly Sale Summary (2025)
  '1212235403500194', // B2 - Sale Report (2026)
  '1212750314147475', // Stockton - PGE (2026)
  '1213225377996361', // Pay Packinglist - B123 (2026)
  '1213319678708251', // Follow up with Liem - TOAST (2026)
  '1213165497373071', // Pay HEO Creditcard - B123 (2026)
  '1214109821645906', // Pay Traveler's Insurance (2026)
  '1215306222546241', // Bakudan 2 & 3 - CPS Energy (2026)
  '1214200637804018', // Tax for bakudan (2026)
  '1214892264828699', // Weekly Report (2026)
  '1214146433755446', // Toast follow-up meeting (2026)
];

// Remove duplicates
const uniqueDelete = [...new Set(DELETE_IDS)];
console.log(`Deleting ${uniqueDelete.length} tasks...`);

let deleted = 0;
let failed = 0;
for (const id of uniqueDelete) {
  try {
    await api('DELETE', `/tasks/${id}`);
    deleted++;
    console.log(`✓ Deleted ${id}`);
    await sleep(200); // Rate limit
  } catch (e) {
    failed++;
    console.log(`✗ Failed ${id}: ${e.message.substring(0, 100)}`);
  }
}

console.log(`\nDelete complete: ${deleted} deleted, ${failed} failed`);
