/**
 * PM2 Ecosystem — Phase 21: Executive Intelligence Layer
 *
 * Extends the base ecosystem with executive intelligence env vars.
 * Deploy: pm2 start ecosystem.phase21.config.cjs && pm2 save
 *
 * Prerequisites:
 *   1. Postgres running with mi_exec database + pgvector
 *   2. Ollama running with qwen3:14b, qwen3:8b, nomic-embed-text
 *   3. npm ci && npm run build
 *   4. node dist/db/migrate.js (run migrations)
 */

module.exports = {
  apps: [
    {
      name: 'mi-core',
      script: 'server/dist/index.js',
      cwd: 'E:/Project/Master/mi-core',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 10000,
      wait_ready: false,
      listen_timeout: 15000,
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: 5000,
      exp_backoff_restart_delay: 200,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        APP_VERSION: 'phase21',

        // ── Executive Intelligence Model Routes ──────────────────────────────
        MI_EXEC_MODEL: 'qwen3:14b',         // intent, planner, decision, reflection, brief
        MI_EXEC_TOOL_MODEL: 'qwen3:8b',     // tool-heavy execution, coding, QA
        MI_EMBED_MODEL: 'nomic-embed-text',  // vector embeddings
        MI_EXEC_PREMIUM_MODEL: 'qwen3.6:27b', // optional premium reasoning route

        // ── Ollama ───────────────────────────────────────────────────────────
        OLLAMA_BASE_URL: 'http://127.0.0.1:11434',

        // ── Postgres ─────────────────────────────────────────────────────────
        PGHOST: '127.0.0.1',
        PGPORT: '5432',
        PGDATABASE: 'mi_exec',
        PGUSER: 'mi_exec',

        // ── Redis (queue/cache only — not source of truth) ───────────────────
        REDIS_URL: 'redis://127.0.0.1:6379',

        // ── Evidence & Wiki Storage ──────────────────────────────────────────
        EVIDENCE_ROOT: 'E:/Project/Master/mi-core/data/evidence',
        WIKI_ROOT: 'E:/Project/Master/mi-core/data/wiki',
      },
      out_file: 'E:/Project/Master/mi-core/logs/pm2-out.log',
      error_file: 'E:/Project/Master/mi-core/logs/pm2-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── WhatsApp Gateway (unchanged) ───────────────────────────────────────
    {
      name: 'whatsapp-ai-gateway',
      script: 'src/index.js',
      cwd: 'E:/Project/Master/whatsapp-ai-gateway',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 10000,
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: 5000,
      exp_backoff_restart_delay: 200,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: 'E:/Project/Master/whatsapp-ai-gateway/logs/pm2-out.log',
      error_file: 'E:/Project/Master/whatsapp-ai-gateway/logs/pm2-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Antigravity Gateway (unchanged) ────────────────────────────────────
    {
      name: 'antigravity-gateway',
      script: 'src/index.js',
      cwd: 'E:/Project/Master/Agent/antigravity-gateway',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 10000,
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: 5000,
      exp_backoff_restart_delay: 200,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: 'E:/Project/Master/Agent/antigravity-gateway/logs/pm2-out.log',
      error_file: 'E:/Project/Master/Agent/antigravity-gateway/logs/pm2-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
