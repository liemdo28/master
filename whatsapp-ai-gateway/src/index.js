require('dotenv').config();
const { makeLogger } = require('./logger');
const sessionManager = require('./whatsapp/session-manager');
const messageListener = require('./whatsapp/message-listener');
const telegramForwarder = require('./telegram/telegram-forwarder');
const apiServer = require('./api/server');
const aiControl = require('./safety/ai-control');
const { getDb } = require('./storage/sqlite');
const foodSafetyPipeline = require('./food-safety/food-safety-pipeline');
const templateCache      = require('./templates/template-cache');
const templateSyncSvc    = require('./templates/template-sync-service');
const sessionTimeoutSvc  = require('./sessions/session-timeout-service');
const replyService       = require('./whatsapp/reply-service');
const reminderSvc        = require('./workflows/missing-submission-reminder');
const auditTrail         = require('./workflows/audit-trail');
const sheetQueueSvc      = require('./workflows/sheet-write-queue');
const dailyHealthReport  = require('./reports/daily-health-report');
const templateOcrStorage = require('./template-ocr/template-ocr-storage');
const templateOcrGenerator = require('./template-ocr/template-generator');

const log = makeLogger('whatsapp');
const STARTUP_MODE = (process.env.STARTUP_MODE || 'normal').toLowerCase();

function bootStep(name, meta = {}) {
  log.info(name, meta);
  console.log(name);
}

async function main() {
  log.info('=== WhatsApp AI Gateway v2.0 starting ===');
  bootStep('BOOT_STEP_1_CONFIG', { startupMode: STARTUP_MODE });

  // Init DB (creates schema on first run)
  bootStep('BOOT_STEP_2_DB');
  getDb();
  await new Promise(r => setTimeout(r, 300));
  log.info('Database ready');

  // Run DB migrations
  try {
    const { runMigrations } = require('./migrations/migration-runner');
    await runMigrations();
  } catch (err) {
    log.error('Migration failed — aborting startup', { error: err.message });
    process.exit(1);
  }

  // Init safety controls (load persisted state from DB)
  await aiControl.init();

  // Init template cache from SQLite (fast, no network)
  bootStep('BOOT_STEP_3_TEMPLATE');
  await templateCache.warmFromDb();
  log.info('Template cache ready', templateCache.getStatus());

  if (STARTUP_MODE === 'safe') {
    bootStep('BOOT_STEP_4_WHATSAPP', { skipped: true, startupMode: STARTUP_MODE });
    bootStep('BOOT_STEP_5_SERVER');
    await apiServer.start();
    log.warn('STARTUP_MODE=safe active; only DB, template cache, and dashboard started');
    log.info('=== Safe mode systems initialised ===');
    return;
  }

  // Start template sync service (async, non-blocking — first sync happens in background)
  templateSyncSvc.start();

  // Ensure printed Template OCR artifacts exist. Regenerate manually or via dashboard
  // after Daily_Entry_Template changes.
  await templateOcrStorage.ensureTables().catch(err => log.warn('Template OCR table init failed', { error: err.message }));
  try {
    templateOcrGenerator.generateDailyEntryTemplate();
    log.info('Template OCR printable template ready');
  } catch (err) {
    log.warn('Template OCR template generation skipped', { error: err.message });
  }

  // Start session timeout service (checks every minute)
  // Send function injected after WhatsApp client is ready
  sessionTimeoutSvc.start();

  // Init YoLink sensor poller (Phase 1.2C) — non-blocking, fails gracefully
  let yolinkPoller;
  try { yolinkPoller = require('./integrations/yolink/yolink-poller'); } catch (_) {}
  if (yolinkPoller) {
    yolinkPoller.start();
    const status = yolinkPoller.getStatus();
    if (status.enabled) {
      log.info('YoLink poller started', { interval: status.intervalSeconds });
    } else {
      log.info('YoLink poller disabled (not configured) — human workflow remains active');
    }
  }

  // Init food safety image pipeline if enabled
  await foodSafetyPipeline.init();

  // Init Telegram
  telegramForwarder.init();

  // WhatsApp is intentionally deferred until after the dashboard binds.
  bootStep('BOOT_STEP_4_WHATSAPP', { deferredUntilServerReady: true });

  // Init API/Dashboard
  bootStep('BOOT_STEP_5_SERVER');
  await apiServer.start();

  // Init WhatsApp
  bootStep('BOOT_STEP_4_WHATSAPP_INIT');
  await sessionManager.init();

  // Attach message listener (session-manager creates the client)
  const client = sessionManager.getClient();
  messageListener.attach(client);

  // Inject WhatsApp send function into timeout service so it can farewell messages
  sessionTimeoutSvc.setSendFunction(async (chatId, text) => {
    if (!client) return;
    try { await replyService.send(client, chatId, text); } catch (_) {}
  });

  // Start missing submission reminder service (uses same send function)
  reminderSvc.setSendFunction(async (chatId, text) => {
    if (!client) return;
    try { await replyService.send(client, chatId, text); } catch (_) {}
  });
  reminderSvc.start();

  // Init audit trail tables (creates schema on boot)
  auditTrail.ensureTables().catch(err => log.warn('Audit trail init failed', { error: err.message }));

  // Start sheet write queue retry scheduler
  sheetQueueSvc.startRetryScheduler();

  // Start auto-update background checker (checks every UPDATE_CHECK_INTERVAL_HOURS, default 6h)
  const updateService = (() => { try { return require('./updater/update-service'); } catch (_) { return null; } })();
  if (updateService) updateService.startAutoCheck();

  // Start daily health report service
  dailyHealthReport.setSendFunction(async (chatId, text) => {
    if (!client) return;
    try { await replyService.send(client, chatId, text); } catch (_) {}
  });
  dailyHealthReport.start();

  log.info('=== All systems initialised ===');
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
