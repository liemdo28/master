module.exports = {
  apps: [
    {
      name: 'antigravity-gateway',
      script: 'E:\\Project\\Master\\Agent\\agent-coding-api-keys\\dist\\server.js',
      cwd: 'E:\\Project\\Master\\Agent\\agent-coding-api-keys',
      windowsHide: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'agent-control',
      script: 'E:\\Project\\Master\\agent-os\\agent-control\\dist\\server.js',
      cwd: 'E:\\Project\\Master\\agent-os\\agent-control',
      windowsHide: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        MASTER_ROOT: 'E:\\Project\\Master',
        PORT: '3700',
      },
    },
    {
      name: 'agent-worker',
      script: 'E:\\Project\\Master\\agent-os\\agent-worker\\dist\\worker.js',
      cwd: 'E:\\Project\\Master\\agent-os\\agent-worker',
      windowsHide: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        MASTER_ROOT: 'E:\\Project\\Master',
      },
    },
  ],
};
