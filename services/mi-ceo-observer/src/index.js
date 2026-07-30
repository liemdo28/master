/**
 * Mi CEO Observer — Session A Entry Point
 *
 * Runs as a separate PM2 process (mi-ceo-observer).
 * Completely isolated from whatsapp-ai-gateway (Session B).
 *
 * Flow:
 *   CEO WhatsApp account (Session A)
 *     → whatsapp-web.js Client (separate Puppeteer, separate session dir)
 *     → task-detector (NLP: tasks, deadlines, finance, approvals)
 *     → whitelist check (group/contact filter)
 *     → mi-core-client POST /api/whatsapp/mi
 *     → mi-core GStack pipeline
 *     → response delivered via Session B (whatsapp-ai-gateway)
 */

require('dotenv').config();

const logger = require('./logger');
const ceoSession = require('./ceo-session');
const apiServer = require('./api-server');

async function main() {
  logger.info('=== Mi CEO Observer (Session A) starting ===');
  logger.info('Session isolation: SEPARATE from whatsapp-ai-gateway (Session B)');
  logger.info(`Session storage: ${process.env.CEO_SESSION_ROOT || './data/ceo-session'}`);
  logger.info(`Mi-Core URL: ${process.env.MI_CORE_URL || 'http://localhost:4001'}`);

  if (!process.env.MI_CORE_API_KEY) {
    logger.warn('MI_CORE_API_KEY not set — events will not be forwarded to mi-core until configured');
  }

  // Start API server (status/health/policy management)
  apiServer.start();

  // Start CEO WhatsApp session
  logger.info('Initializing CEO WhatsApp session (Session A)...');
  logger.info('If first-time setup: scan the QR code with the CEO main account phone');
  await ceoSession.start();
}

main().catch(e => {
  logger.error('Fatal startup error', { error: e.message, stack: e.stack });
  process.exit(1);
});
