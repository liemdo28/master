const mysql = require('mysql2');
const conn = mysql.createConnection({
  host: 'mysql-taskflow.bakudanramen.com',
  user: 'liemdo',
  password: 'liem@dt2155',
  database: 'taskflow_db'
});
conn.connect();
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 7);
const cutStr = cutoff.toISOString().slice(0,10);
conn.query(
  `SELECT t.id, t.title, t.due_date, DATEDIFF(CURDATE(), t.due_date) as overdue_days,
          u.name as assignee_name, p.name as project_name, t.priority
   FROM tasks t
   LEFT JOIN users u ON t.assignee_id = u.id
   LEFT JOIN projects p ON t.project_id = p.id
   WHERE t.is_completed = 0 AND t.due_date < ?
   ORDER BY overdue_days DESC LIMIT 50`,
  [cutStr],
  (err, rows) => {
    if (err) { console.error(err.message); conn.end(); return; }
    console.log('OVERDUE > 7 DAYS: ' + rows.length + ' total\n');
    rows.forEach(r => {
      console.log('[' + r.overdue_days + 'd] #' + r.id + ' | ' + r.title + ' | due ' + r.due_date + ' | ' + (r.assignee_name||'-') + ' | ' + (r.project_name||'-') + ' | ' + r.priority);
    });
    conn.end();
  }
);
