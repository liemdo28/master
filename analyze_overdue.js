const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/Project/Master/asana_overdue.json','utf8'));
const tasks = data.asana || [];
const cutoff = new Date('2026-06-24');
const today = new Date('2026-07-01');

const all = tasks.filter(t => new Date(t.due_on) <= today);
const recent = all.filter(t => new Date(t.due_on) >= cutoff);
const older = all.filter(t => new Date(t.due_on) < cutoff);

console.log('Total overdue: ' + all.length);
console.log('Within 7 days (Jun 24 - Jul 1): ' + recent.length);
console.log('Over 7 days (before Jun 24): ' + older.length);
console.log('');

// Recent
console.log('=== RECENT OVERDUE (within 7 days) ===');
recent.forEach(t => {
  const d = new Date(t.due_on);
  const days = Math.floor((today - d) / 86400000);
  console.log('[' + days + 'd] ' + (t.name||'(no title)').substring(0,65) + ' | due ' + t.due_on);
});

console.log('');
// Older - top 10
console.log('=== OVER 7 DAYS OLDEST (top 15) ===');
older.sort((a,b) => new Date(a.due_on) - new Date(b.due_on)).slice(0,15).forEach(t => {
  const d = new Date(t.due_on);
  const days = Math.floor((today - d) / 86400000);
  console.log('[' + days + 'd] ' + (t.name||'(no title)').substring(0,65) + ' | due ' + t.due_on);
});
