# Agent OS - App Launcher

## Overview

Cho phép Agent Worker mở ứng dụng đã được approve.

## Supported Apps

### ✅ Approved Apps

| App | Command | Path |
|-----|---------|------|
| VS Code | `code` | System PATH |
| Cursor | `cursor` | System PATH |
| Chrome | `chrome` | System PATH |
| Edge | `msedge` | System PATH |
| Firefox | `firefox` | System PATH |
| Windows Terminal | `wt` | System PATH |
| Git Bash | `bash` | System PATH |
| Docker Desktop | `docker` | System PATH |
| GitHub Desktop | `github` | System PATH |
| Postman | `postman` | System PATH |
| File Explorer | `explorer` | System PATH |
| Notepad | `notepad` | System PATH |

### ⛔ Blocked Apps

| App | Reason |
|-----|--------|
| WhatsApp | Personal messaging |
| Viber | Personal messaging |
| Zalo | Personal messaging |
| Telegram | Personal messaging |
| Discord | Personal messaging |
| Skype | Personal messaging |

## Task Definition

```json
{
  "type": "app_launch",
  "project": "E:\\Project\\Master",
  "payload": {
    "action": "open",
    "app": "vscode",
    "path": "E:\\Project\\Master\\Agent"
  }
}
```

## Handler Implementation

```typescript
const APPROVED_APPS: Record<string, string> = {
  'vscode': 'code',
  'code': 'code',
  'cursor': 'cursor',
  'chrome': 'chrome',
  'edge': 'msedge',
  'msedge': 'msedge',
  'firefox': 'firefox',
  'terminal': 'wt',
  'wt': 'wt',
  'bash': 'bash',
  'docker': 'docker',
  'github': 'github',
  'postman': 'postman',
  'explorer': 'explorer',
  'notepad': 'notepad',
};

const BLOCKED_APPS = ['whatsapp', 'viber', 'zalo', 'telegram', 'discord', 'skype'];

export async function handleAppLaunch(task: any) {
  const { action, app, path } = task.payload;
  
  if (action === 'open') {
    return await openApp(app, path);
  }
  
  if (action === 'close') {
    return await closeApp(app);
  }
}

async function openApp(app: string, targetPath?: string): Promise<any> {
  // Normalize app name
  const normalizedApp = app.toLowerCase().trim();
  
  // Check if blocked
  if (BLOCKED_APPS.includes(normalizedApp)) {
    log('warn', `Blocked app attempt: ${app}`);
    throw new Error(`App ${app} is blocked`);
  }
  
  // Get command
  const command = APPROVED_APPS[normalizedApp];
  if (!command) {
    throw new Error(`Unknown app: ${app}`);
  }
  
  // Build command
  let fullCommand = command;
  if (targetPath) {
    fullCommand = `${command} "${targetPath}"`;
  }
  
  // Execute
  log('info', `Opening app: ${app}`, { path: targetPath });
  const result = await execCommand(fullCommand, process.cwd());
  
  // Audit log
  await audit.log({
    workerId: task.workerId,
    taskId: task.id,
    type: 'apps:open',
    action: `Open ${app}${targetPath ? ` with ${targetPath}` : ''}`,
    project: targetPath,
    permission: 'apps:open',
    status: 'success',
  });
  
  return { success: true, app, path: targetPath };
}

async function closeApp(app: string): Promise<any> {
  const normalizedApp = app.toLowerCase();
  
  if (BLOCKED_APPS.includes(normalizedApp)) {
    throw new Error(`Cannot close blocked app: ${app}`);
  }
  
  // Find process and kill
  const processName = APPROVED_APPS[normalizedApp] || normalizedApp;
  await execCommand(`taskkill /IM ${processName}.exe /F`, process.cwd());
  
  return { success: true, closed: app };
}
```

## Open Project Folder

Special task để mở project folder trong explorer hoặc VS Code:

```json
{
  "type": "open_project",
  "payload": {
    "path": "E:\\Project\\Master\\Agent",
    "app": "vscode"
  }
}
```

```typescript
async function handleOpenProject(task: any) {
  const { path, app } = task.payload;
  
  // Verify path exists
  if (!fs.existsSync(path)) {
    throw new Error(`Project not found: ${path}`);
  }
  
  if (app === 'vscode' || app === 'explorer') {
    const command = app === 'explorer' ? `explorer "${path}"` : `code "${path}"`;
    await execCommand(command, process.cwd());
  }
}
```
