/**
 * PM2 Ecosystem — Mi-Core Production
 * Manages: Mi-Core Server + Python AI Service + Node Agent
 *
 * Usage:
 *   pm2 start ecosystem.config.js          — start all
 *   pm2 start ecosystem.config.js --env production
 *   pm2 restart ecosystem.config.js --only mi-core
 *   pm2 logs mi-core
 *   pm2 save && pm2 startup               — persist across reboots
 */

module.exports = {
  apps: [
    // ── Accounting Engine (local API, port 8844) ─────────────────────────────
    {
      name: 'mi-accounting',
      script: 'api/server.js',
      cwd: 'E:/Project/Master/mi-core/services/accounting-engine',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'development',
        ACCOUNTING_API_PORT: '8844',
      },
      error_file: 'E:/Project/Master/.local-agent-global/logs/accounting-error.log',
      out_file:   'E:/Project/Master/.local-agent-global/logs/accounting-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },

    // ── Mi CEO Observer — Session A (CEO Main Account reader) ────────────────
    {
      name: 'mi-ceo-observer',
      script: 'src/index.js',
      cwd: 'E:/Project/Master/mi-core/services/mi-ceo-observer',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 15000,
      env: {
        NODE_ENV: 'development',
        CEO_SESSION_ROOT: 'E:/Project/Master/mi-core/services/mi-ceo-observer/data/ceo-session',
        CEO_CLIENT_ID: 'mi-ceo-observer',
        OBSERVER_PORT: '3212',
        MI_CORE_URL: 'http://127.0.0.1:4001',
        WHATSAPP_HEADLESS: 'true',
        LOG_DIR: 'E:/Project/Master/mi-core/services/mi-ceo-observer/logs',
        TASK_DETECTION_SENSITIVITY: '2',
        OBSERVE_PRIVATE_CHATS: 'true',
        OBSERVE_GROUPS: 'true',
      },
      error_file: 'E:/Project/Master/.local-agent-global/logs/ceo-observer-error.log',
      out_file:   'E:/Project/Master/.local-agent-global/logs/ceo-observer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },

    // ── Mi-Core Central Command ──────────────────────────────────────────────
    {
      name: 'mi-core',
      script: 'server/dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      kill_timeout: 15000,
      wait_ready: true,
      listen_timeout: 35000,
      max_restarts: 15,
      restart_delay: 5000,
      exp_backoff_restart_delay: 500,
      env: {
        NODE_ENV: 'development',
        MI_PORT: '4001',
        HOST: '0.0.0.0',
        MI_NODE_ID: 'mi-core-primary',
      },
      env_production: {
        NODE_ENV: 'production',
        MI_PORT: '4001',
        HOST: '0.0.0.0',
        MOBILE_ACCESS: '1',
        MI_NODE_ID: 'mi-core-primary',
      },
      error_file: '.local-agent-global/logs/mi-core-error.log',
      out_file:   '.local-agent-global/logs/mi-core-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },

    // ── Python AI Service (FastAPI wrapper for Ollama) ──────────────────────
    {
      name: 'mi-ai-service',
      script: 'python',
      args: '-m uvicorn main:app --host 127.0.0.1 --port 4002',
      cwd: __dirname + '/ai-service',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      env: {
        OLLAMA_URL: 'http://localhost:11434',
      },
      env_production: {
        OLLAMA_URL: 'http://localhost:11434',
      },
      error_file: __dirname + '/.local-agent-global/logs/mi-ai-service-error.log',
      out_file:   __dirname + '/.local-agent-global/logs/mi-ai-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },

    // ── WhatsApp AI Gateway (CEO WhatsApp interface) ─────────────────────────
    {
      name: 'mi-whatsapp-gateway',
      script: 'src/index.js',
      cwd: 'E:/Project/Master/mi-core/services/whatsapp-ai-gateway',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      restart_delay: 10000,
      max_restarts: 20,
      min_uptime: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: '3211',
        WHATSAPP_HEADLESS: 'true',
        AUTO_RECONNECT: 'true',
        MI_CORE_URL: 'http://127.0.0.1:4001',
        WHATSAPP_SESSION_ROOT: 'E:/Project/Master/mi-core/services/whatsapp-ai-gateway/data/whatsapp',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3211',
        WHATSAPP_HEADLESS: 'true',
        AUTO_RECONNECT: 'true',
        MI_CORE_URL: 'http://127.0.0.1:4001',
        WHATSAPP_SESSION_ROOT: 'E:/Project/Master/mi-core/services/whatsapp-ai-gateway/data/whatsapp',
      },
      error_file: 'E:/Project/Master/mi-core/services/whatsapp-ai-gateway/logs/pm2-err.log',
      out_file:   'E:/Project/Master/mi-core/services/whatsapp-ai-gateway/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },

    // ── n8n Execution Bus ────────────────────────────────────────────────────
    {
      name: 'mi-n8n',
      script: 'services/n8n-execution-bus/n8n-start.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 5000,
      env: {
        N8N_PORT: '5678',
        N8N_HOST: '127.0.0.1',
        N8N_LISTEN_ADDRESS: '127.0.0.1',
        N8N_LOG_LEVEL: 'warn',
        WEBHOOK_URL: 'http://127.0.0.1:5678',
      },
      error_file: '.local-agent-global/logs/n8n-error.log',
      out_file:   '.local-agent-global/logs/n8n-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },

    // ── QuickBooks Ops Agent (QBWC + heartbeat, port 3457) ──────────────────
    {
      name: 'qb-ops-agent',
      script: 'dist/index.js',
      cwd: __dirname + '/services/qb-ops-agent',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 10000,
      max_restarts: 10,
      min_uptime: 10000,
      env: {
        NODE_ENV: 'development',
        MI_CORE_URL: 'http://127.0.0.1:4001',
        QBWC_PORT: '3457',
        MACHINE_ID: 'qb-laptop-01',
      },
      env_production: {
        NODE_ENV: 'production',
        MI_CORE_URL: 'http://127.0.0.1:4001',
        QBWC_PORT: '3457',
        MACHINE_ID: 'qb-laptop-01',
      },
      error_file: __dirname + '/services/qb-ops-agent/logs/pm2-error.log',
      out_file:   __dirname + '/services/qb-ops-agent/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },

    // ── Node Agent (secondary device discovery) ──────────────────────────────
    {
      name: 'mi-node-agent',
      script: 'node-agent.mjs',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '128M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: 5000,
      exp_backoff_restart_delay: 500,
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        MI_SERVER_URL: 'http://127.0.0.1:4001',
        MI_NODE_ID: 'mi-core-primary',
        MI_NODE_NAME: 'Mi-Core-Primary',
        MI_NODE_PORT: '4004',
        MI_CAPABILITIES: 'gstack,whatsapp,health-monitor,browser-agent,graph,digital-twin',
      },
      env_production: {
        NODE_ENV: 'production',
        MI_SERVER_URL: 'http://127.0.0.1:4001',
        MI_NODE_ID: 'mi-core-primary',
        MI_NODE_NAME: 'Mi-Core-Primary',
        MI_NODE_PORT: '4004',
        MI_CAPABILITIES: 'gstack,whatsapp,health-monitor,browser-agent,graph,digital-twin',
      },
      error_file: '.local-agent-global/logs/node-agent-error.log',
      out_file:   '.local-agent-global/logs/node-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
