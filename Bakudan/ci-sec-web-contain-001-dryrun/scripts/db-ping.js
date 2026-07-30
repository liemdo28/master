'use strict';
const mysql = require('mysql2/promise');
async function main() {
  process.stdout.write('Connecting to DB...\n');
  const conn = await mysql.createConnection({
    host: 'mysql-taskflow.bakudanramen.com',
    port: 3306,
    user: 'liemdo',
    password: '',
    database: 'taskflow_db',
    connectTimeout: 10000,
  });
  process.stdout.write('DB connected\n');
  const [tasks] = await conn.query('SELECT COUNT(*) AS cnt FROM tasks');
  process.stdout.write('Tasks: ' + tasks[0].cnt + '\n');
  const [bills] = await conn.query('SELECT COUNT(*) AS cnt FROM bills');
  process.stdout.write('Bills: ' + bills[0].cnt + '\n');
  const [stores] = await conn.query('SELECT COUNT(*) AS cnt FROM stores');
  process.stdout.write('Stores: ' + stores[0].cnt + '\n');
  const [users] = await conn.query('SELECT COUNT(*) AS cnt FROM users');
  process.stdout.write('Users: ' + users[0].cnt + '\n');
  const [penalties] = await conn.query('SELECT COUNT(*) AS cnt FROM penalties');
  process.stdout.write('Penalties: ' + penalties[0].cnt + '\n');
  await conn.end();
  process.stdout.write('Done\n');
}
main().then(() => process.exit(0)).catch(e => {
  process.stdout.write('ERROR: ' + e.code + ' ' + e.message.slice(0, 200) + '\n');
  process.exit(1);
});