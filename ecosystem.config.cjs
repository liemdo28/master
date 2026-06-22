/**
 * PM2 Ecosystem — Mi-Core + WhatsApp Gateway + Antigravity
 * Replaces manual pm2 start commands.
 * Deploy: pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'mi-core',
      script: 'server/dist/index.js',
      cwd: 'E:/Project/Master/mi-core',
      instances: 1,
      exec_mode: 'fork',
      // Graceful shutdown — pairs with SIGTERM handler in index.ts
      kill_timeout: 10000,
      wait_ready: false,
      listen_timeout: 15000,
      // Restart policy
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: 5000,
      exp_backoff_restart_delay: 200,
      // Memory guard — restart if over 512MB
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      // Log
      out_file: 'E:/Project/Master/mi-core/logs/pm2-out.log',
      error_file: 'E:/Project/Master/mi-core/logs/pm2-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
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
