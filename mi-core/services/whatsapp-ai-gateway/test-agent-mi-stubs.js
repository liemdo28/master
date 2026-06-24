/**
 * Agent-Coding and Mi-Core stub services for validation testing.
 * Simulates the expected endpoints so the forwarder can test end-to-end.
 */

const express = require('express');

// ── Agent-Coding Stub (port 3100) ──────────────────────────────────────────
const agentApp = express();
agentApp.use(express.json());

agentApp.post('/api/whatsapp/agent', (req, res) => {
  const { text, sender, chat_id } = req.body || {};
  console.log('[AGENT-STUB] received:', { text: (text || '').slice(0, 80), sender, chat_id });

  // Simulate different responses based on message content
  if (text && text.toLowerCase().includes('qa')) {
    return res.json({
      ok: true,
      reply: `✅ *QA Run Started*\n\nRunning QA on \`${text.replace('run QA ', '')}\`...\n\n• Checking workflows... ✅\n• Validating templates... ✅\n• Testing connections... ✅\n\nAll checks passed.`,
      actions: ['run_qa', 'log_result'],
      metadata: { task: 'qa_run', status: 'started' },
    });
  }

  if (text && text.toLowerCase().includes('workflow')) {
    return res.json({
      ok: true,
      reply: `📋 *Active Workflows*\n\n1. Daily Entry — 3 stores (PASS)\n2. Template Sync — idle\n3. Photo Audit — 0 pending\n4. Food Safety — monitoring\n\nUse \`/agent run QA <name>\` to run specific tests.`,
      actions: ['list_workflows'],
      metadata: { workflows: ['daily_entry', 'template_sync', 'photo_audit', 'food_safety'] },
    });
  }

  // Default response
  res.json({
    ok: true,
    reply: `✅ *Agent-Coding received:*\n\`\`\`\n${text || '(empty)'}\n\`\`\`\n\nProcessing your request...`,
    actions: ['acknowledge'],
    metadata: { status: 'received' },
  });
});

agentApp.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'agent-coding',
    version: '1.0.0',
    status: 'ready',
    uptime_seconds: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
});

agentApp.get('/health', (req, res) => {
  res.json({ ok: true, service: 'agent-coding', status: 'ready' });
});

// ── Mi-Core Stub (port 3200) ──────────────────────────────────────────────
const miApp = express();
miApp.use(express.json());

miApp.post('/api/whatsapp/mi', (req, res) => {
  const { text, sender, chat_id } = req.body || {};
  console.log('[MI-STUB] received:', { text: (text || '').slice(0, 80), sender, chat_id });

  if (text && text.toLowerCase().includes('chào')) {
    return res.json({
      ok: true,
      reply: `👋 Chào bạn! Mình là trợ lý Mi đây. Bạn cần mình giúp gì hôm nay?`,
      actions: ['greet'],
      metadata: { language: 'vi' },
    });
  }

  if (text && text.toLowerCase().includes('làm gì')) {
    return res.json({
      ok: true,
      reply: `🤔 *Gợi ý cho hôm nay:*\n\n1. 📊 Check báo cáo Daily Entry\n2. 📋 Xem danh sách công việc còn tồn\n3. 🔍 Kiểm tra nhiệt độ kho lạnh\n4. 📝 Tạo task mới cho team\n\nBạn muốn làm gì trước?`,
      actions: ['suggest'],
      metadata: { suggestions: ['daily_entry', 'tasks', 'temperature', 'new_task'] },
    });
  }

  if (text && text.toLowerCase().includes('tóm tắt')) {
    return res.json({
      ok: true,
      reply: `📊 *Tóm tắt chat hôm nay*\n\n• Stone Oak: ✅ Đã gửi lúc 8:30 AM\n• Bandera: ✅ Đã gửi lúc 9:15 AM\n• Rim: ⏳ Chưa gửi\n\n• Cảnh báo: 0\n• Nhiệt độ: Tất cả trong ngưỡng cho phép`,
      actions: ['summarize'],
      metadata: { summary: { stone_oak: 'done', bandera: 'done', rim: 'pending' } },
    });
  }

  if (text && text.toLowerCase().includes('task') && text.toLowerCase().includes('maria')) {
    return res.json({
      ok: true,
      reply: `📝 *Task Proposal*\n\n*Task:* ${text.replace('/mi ', '')}\n*Assigned to:* Maria\n*Status:* ⏳ Pending approval\n\n*Approval required:* Yes\nUse \`/approve <id>\` to approve.`,
      actions: ['propose_task'],
      approval_required: true,
      approval_id: 'task-maria-' + Date.now(),
      metadata: { task: text, assignee: 'Maria', status: 'pending_approval' },
    });
  }

  // Default response
  res.json({
    ok: true,
    reply: `✅ *Mi received:*\n\`\`\`\n${text || '(empty)'}\n\`\`\`\n\nLet me look into that for you.`,
    actions: ['acknowledge'],
    metadata: { status: 'received' },
  });
});

miApp.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'mi-core',
    version: '1.0.0',
    status: 'ready',
    uptime_seconds: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
});

miApp.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mi-core', status: 'ready' });
});

// ── Start ──────────────────────────────────────────────────────────────────
const AGENT_PORT = 3100;
const MI_PORT = 3200;

const agentServer = agentApp.listen(AGENT_PORT, () => {
  console.log(`[AGENT-STUB] Agent-Coding running on http://localhost:${AGENT_PORT}`);
});

const miServer = miApp.listen(MI_PORT, () => {
  console.log(`[MI-STUB] Mi-Core running on http://localhost:${MI_PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n[STUBS] Shutting down...');
  agentServer.close();
  miServer.close();
  process.exit(0);
});
