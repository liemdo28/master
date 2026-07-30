const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/Project/Master/asana_overdue.json','utf8'));
const tasks = data.asana || [];
const today = new Date('2026-07-01');
const cutoff = new Date('2026-06-24');
const old = tasks.filter(t => {
  const d = new Date(t.due_on);
  return d < cutoff;
}).sort((a,b) => new Date(a.due_on) - new Date(b.due_on));

console.log('TASKS OVERDUE > 7 DAYS: ' + old.length + ' total\n');
old.forEach(t => {
  const d = new Date(t.due_on);
  const days = Math.floor((today - d) / 86400000);
  const title = t.name || '(no title)';
  const proj = (t.projects && t.projects.length > 0) ? t.projects.join(', ') : '-';
  console.log('[' + days + 'd] ' + title.substring(0,60) + ' | due ' + t.due_on + ' | proj: ' + proj);
});
