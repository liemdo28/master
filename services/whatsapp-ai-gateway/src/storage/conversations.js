const { run, all, get } = require('./sqlite');

async function saveMessage({ phone, name, direction, message, intent = null, aiReplied = false }) {
  const timestamp = new Date().toISOString();
  await run(
    `INSERT INTO conversations (phone, name, direction, message, intent, ai_replied, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [phone, name || phone, direction, message, intent, aiReplied ? 1 : 0, timestamp]
  );
  await run(
    `INSERT INTO contacts (phone, name, first_seen, last_seen, message_count)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(phone) DO UPDATE SET
       name = excluded.name,
       last_seen = excluded.last_seen,
       message_count = message_count + 1`,
    [phone, name || phone, timestamp, timestamp]
  );
}

async function getRecentConversations(limit = 50) {
  const filter = getLiveDisplayFilter();
  return all(`SELECT * FROM conversations ${filter.where} ORDER BY created_at DESC LIMIT ?`, [...filter.params, limit]);
}

async function getConversationByPhone(phone, limit = 20) {
  return all(`SELECT * FROM conversations WHERE phone = ? ORDER BY timestamp DESC LIMIT ?`, [phone, limit]);
}

async function getTodayStats() {
  const today = new Date().toISOString().slice(0, 10);
  const filter = getLiveDisplayFilter('AND');
  const total = await get(`SELECT COUNT(*) as cnt FROM conversations WHERE timestamp LIKE ? ${filter.clause}`, [`${today}%`, ...filter.params]);
  const incoming = await get(`SELECT COUNT(*) as cnt FROM conversations WHERE direction='in' AND timestamp LIKE ? ${filter.clause}`, [`${today}%`, ...filter.params]);
  const last = await get(`SELECT * FROM conversations WHERE direction='in' ${filter.clause} ORDER BY created_at DESC LIMIT 1`, filter.params);
  return { total: total ? total.cnt : 0, incoming: incoming ? incoming.cnt : 0, lastMessage: last || null };
}

function getLiveDisplayFilter(prefix = 'WHERE') {
  if (process.env.SHOW_TEST_MESSAGES === 'true') {
    return { where: '', clause: '', params: [] };
  }
  const condition = `NOT (
    message LIKE 'Load msg %' OR
    name LIKE 'Load%' OR
    phone LIKE '8488%' OR
    name IN ('Rate Tester', 'Load Test')
  )`;
  return {
    where: `${prefix === 'WHERE' ? 'WHERE' : ''} ${condition}`.trim(),
    clause: `${prefix} ${condition}`,
    params: [],
  };
}

module.exports = { saveMessage, getRecentConversations, getConversationByPhone, getTodayStats };
