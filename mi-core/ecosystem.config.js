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
    // ── Mi-Core Central Command ──────────────────────────────────────────────
    {
      name: 'mi-core',
      script: 'server/dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
        MI_PORT: '4001',
        HOST: '127.0.0.1',
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

    // ── Node Agent (secondary device discovery) ──────────────────────────────
    {
      name: 'mi-node-agent',
      script: 'node-agent.mjs',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '64M',
      restart_delay: 5000,
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
