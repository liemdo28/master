const fs = require('fs');
const d = JSON.parse(fs.readFileSync('d:/Project/Master/asana_overdue.json'));
const a = d.asana || [];

const lines = [];
a.sort((x,y) => new Date(x.due_on) - new Date(y.due_on)).forEach(t => {
  lines.push(t.id + '|' + (t.due_on||'') + '|' + (t.name||'') + '|' + JSON.stringify(t.projects||[]));
});

fs.writeFileSync('d:/Project/Master/task_list_full.txt', lines.join('\n'));
console.log('done: ' + lines.length);
