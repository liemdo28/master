const ASANA_TOKEN = '2/1176062377577683/1215527867300666:42abdedcc12014c221eb9498e797b287';
const WORKSPACE_GID = '1175942980830614';
const PROJECTS = {
  finance: '1175942754455038',
  liem: '1176532817723538',
  stoneOak: '1201868494348136'
};
const BASE_URL = 'https://app.asana.com/api/1.0';

async function api(method, endpoint, body) {
  const res = await fetch(BASE_URL + endpoint, {
    method,
    headers: {
      Authorization: 'Bearer ' + ASANA_TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify({ data: body }) : undefined
  });
  const json = await res.json();
  if (!res.ok) throw new Error(method + ' ' + endpoint + ' -> ' + res.status + ': ' + JSON.stringify(json));
  return json;
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

const tasks = [
  ['Stockton - Daily Sale', '2026-07-31', [PROJECTS.liem], 'Monthly - last day of month. Send sale report for RAW Stockton to Raymond, Hoang, Anh.'],
  ['Stockton - Void / Discount Log', '2026-08-05', [PROJECTS.liem], 'Monthly - 5th. Update subtotal from POS and compare void/discount log.'],
  ['Stockton - Upload Sale to Homebase', '2026-08-05', [PROJECTS.liem], 'Monthly - 5th. Download and input sales numbers to Homebase.'],
  ['Stockton - Void Log', '2026-08-05', [PROJECTS.liem], 'Monthly - 5th. Check Void and Discount sheet with Toast.'],
  ['JHT - Update Sale data', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Update JHT sale data spreadsheet.'],
  ['Credit Card - Update file', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Update credit card tracking files.'],
  ['Bakudan LLC - Send Monthly Sale Summary', '2026-08-03', [PROJECTS.finance], 'Monthly - 2nd to 5th. Submit sale summary to SnapPayPD portal.'],
  ['B1 & B2 - Ramen Premix File', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Download daily order items for B1 and B2.'],
  ['Qida Ma Spreadsheet update', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Update Qida sheet / Owed tab.'],
  ['Pay Packinglist - B123', '2026-08-10', [PROJECTS.finance], 'Monthly - 10th. Track packing list debt for B123.'],
  ['Pay HEO Creditcard - B123', '2026-08-10', [PROJECTS.finance], 'Monthly - 10th. Track HEO Chase Card payments for B123.'],
  ['Bakudan 2 & 3 - CPS Energy', '2026-08-08', [PROJECTS.finance], 'Monthly - 8th. Pay with HEO Holding Chase CC. 22506 N US Highway 281 #106 = B2, 11411 De Zavala = B3.'],
  ['Domain - Update Daily Sale', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Update daily sale tracking for domain.'],
  ['Pay cps with credit card', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Pay CPS with credit card.'],
  ['Packing List invoice', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Get B1-B2-B3 packing list monthly cost.'],
  ['Update Cost for Invoice Bakudan', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Track Bakudan invoice cost changes.'],
  ['Stockton - Prepayment Tax', '2026-10-08', [PROJECTS.liem], 'Quarterly - 8th of Jan/Apr/Jul/Oct. CA BOE efile. Login: efile.boe.ca.gov, Account: 100772059.'],
  ['JHT - Send Quarterly Sale Summary', '2026-10-04', [PROJECTS.liem], 'Quarterly - 4th of Jan/Apr/Jul/Oct. Upload to TOAST portal.'],
  ['Provide total for True World modesto on Heo Card', '2026-10-05', [PROJECTS.finance], 'Quarterly - 5th of Jan/Apr/Jul/Oct. Track Trueworld modesto on HEO card.'],
  ['Follow up with Liem - TOAST to QuickBooks Integration Status', '2026-10-10', [PROJECTS.finance], 'Quarterly - 10th of Jan/Apr/Jul/Oct. Check integration progress.'],
  ['Pay Hoang Reimbursement - IFT', '2026-10-10', [PROJECTS.finance], 'Quarterly - 10th. Create IFT reimbursement report for Hoang credit card.'],
  ['Tax for bakudan', '2027-05-15', [PROJECTS.finance], 'Annual - May 15. Texas TWC tax. Login: apps.twc.texas.gov, User: bakudanramen210, Pass: Bakudan$1.'],
  ['Pay Travel Insurance - Bakudan Ramen Inc', '2027-04-15', [PROJECTS.stoneOak], 'Annual - Apr 15. ~$5,000/year Travelers Insurance.'],
  ['B2 - Sale Report', '2027-01-01', [PROJECTS.finance], 'Annual - Jan 1. Report to Village at Stone Oak for lease obligations.'],
  ['Stockton - PGE', '2026-08-10', [PROJECTS.liem], 'Monthly - 10th. Pay Stockton PGE bill. pge.com - rawsushi/afroken.'],
  ['Book Flight', '2026-12-31', [PROJECTS.finance], 'As needed. Book flights per Raw Machine spreadsheet.'],
  ['Liem - Add flights expense to QB', '2026-08-15', [PROJECTS.finance], 'One-time. Add flights expense to QuickBooks.'],
  ['Report - IFT', '2026-10-05', [PROJECTS.finance], 'Quarterly - 5th. IFT expense report.'],
  ['Report Expense - B123', '2026-08-05', [PROJECTS.finance], 'Monthly - 5th. Upload expense report to QB B123.'],
  ['Franchise Tax - All Company', '2026-10-15', [PROJECTS.finance], 'Quarterly - Oct 15 (Q4), Jan 15 (Q1), Apr 15 (Q2), Jul 15 (Q3). Enter Revenue and Net Income.'],
];

(async () => {
  console.log('Creating ' + tasks.length + ' recurring tasks...\n');
  let created = 0;
  for (const [name, due, projects, notes] of tasks) {
    try {
      const result = await api('POST', '/tasks', {
        workspace: WORKSPACE_GID,
        name,
        due_on: due,
        notes: notes + '\n\n[Mi cleanup 2026-07-01] Old overdue copies were bulk deleted. Create next cycle when done.',
        projects
      });
      console.log('Created: ' + name + ' | due ' + due);
      created++;
      await wait(300);
    } catch (e) {
      console.log('FAIL: ' + name + ' | ' + e.message.substring(0, 120));
    }
  }
  console.log('\nDone: ' + created + ' / ' + tasks.length + ' tasks created');
})();
