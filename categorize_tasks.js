const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/Project/Master/asana_overdue.json','utf8'));
const tasks = data.asana || [];

// Categorize by base pattern
const groups = {};
tasks.forEach(t => {
  const name = t.name || '(no title)';
  // Normalize: strip trailing dates/times
  let key = name
    .replace(/\s*[-–—]\s*\d{1,2}\/\d{1,2}\/\d{2,4}/g,'')
    .replace(/\s*[-–—]\s*[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4}/g,'')
    .replace(/\s*@\s*\d{1,2}:\d{2}\s*[AP]M/gi,'')
    .replace(/\s*\(?\d{4}-\d{2}-\d{2}\)?/g,'')
    .trim();
  if (!groups[key]) groups[key] = [];
  groups[key].push({name, due: t.due_on, id: t.id});
});

const recurring = Object.entries(groups).filter(([,v]) => v.length > 1);
const singles = Object.entries(groups).filter(([,v]) => v.length === 1);

console.log('RECURRING PATTERNS (' + recurring.length + ' groups):');
recurring.sort((a,b) => b[1].length - a[1].length).forEach(([k,v]) => {
  const dates = v.map(t=>t.due_on).sort();
  const span = dates.length > 1 ? 
    Math.round((new Date(dates[dates.length-1]) - new Date(dates[0])) / (1000*86400*30)) + 'mo span' : '';
  console.log('[' + v.length + 'x] ' + k.substring(0,55) + ' | span:' + span);
  dates.forEach(d => console.log('  DUE: ' + d));
});

console.log('\nSINGLE TASKS (' + singles.length + '):');
singles.sort((a,b) => new Date(a[1][0].due) - new Date(b[1][0].due))
  .slice(0,25).forEach(([k,v]) => {
  console.log('DUE:' + v[0].due + ' | ' + k.substring(0,60));
});
