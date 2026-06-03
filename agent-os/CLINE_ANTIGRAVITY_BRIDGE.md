# Agent OS - Cline/Antigravity Bridge

## Overview

Cho phép Agent Worker điều khiển Cline/Antigravity để thực hiện công việc development tự động.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Control Plane                      │
│                        Port: 3700                           │
└─────────────────────────────┬───────────────────────────────┘
                              │ Task: cline_control
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PC Worker (L2+)                          │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐  │
│  │ Task Queue  │────▶│Bridge Agent│────▶│ Cline/       │  │
│  │             │     │            │     │ Antigravity   │  │
│  └─────────────┘     └──────┬──────┘     └──────────────┘  │
│                              │                               │
│                              │ inject_prompt()               │
│                              │ start_work()                  │
│                              ▼                               │
│                     ┌──────────────┐                        │
│                     │ Log Monitor   │                        │
│                     │ & Stream      │                        │
│                     └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Supported Actions

### 1. Open Cline/Antigravity

```json
{
  "taskId": "task-123",
  "type": "cline_control",
  "payload": {
    "action": "open",
    "app": "antigravity",
    "project": "E:\\Project\\Master\\Agent\\agent-coding"
  }
}
```

### 2. Inject Task Prompt

```json
{
  "taskId": "task-123",
  "type": "cline_control",
  "payload": {
    "action": "inject_prompt",
    "prompt": "Build a REST API for the accounting module...",
    "waitForComplete": true,
    "timeout": 3600
  }
}
```

### 3. Run Command

```json
{
  "taskId": "task-123",
  "type": "cline_control",
  "payload": {
    "action": "run_command",
    "command": "npm run build",
    "cwd": "E:\\Project\\Master\\Agent\\agent-coding"
  }
}
```

### 4. Get Status

```json
{
  "taskId": "task-123",
  "type": "cline_control",
  "payload": {
    "action": "status"
  }
}
```

## Implementation

### Handler: handleClineControl

```typescript
export async function handleClineControl(task: any) {
  const { action, app, project, prompt, command, cwd } = task.payload;
  
  switch (action) {
    case 'open':
      await openClineAntigravity(app, project);
      break;
      
    case 'inject_prompt':
      await injectPrompt(prompt, task.payload.waitForComplete, task.payload.timeout);
      break;
      
    case 'run_command':
      await runCommand(command, cwd);
      break;
      
    case 'status':
      return getClineStatus();
  }
}
```

### Open App

```typescript
async function openClineAntigravity(app: string, projectPath: string) {
  const appPaths: Record<string, string> = {
    'cline': 'C:\\Users\\.vscode\\extensions\\saoudrizwan.claude-dev-*/dist/extension.js',
    'antigravity': 'E:\\Agent\\antigravity-ide\\bin\\antigravity.exe',
  };
  
  const appPath = appPaths[app];
  if (!appPath) {
    throw new Error(`Unknown app: ${app}`);
  }
  
  // Open with project
  await execCommand(`start "" "${appPath}" --project "${projectPath}"`, process.cwd());
  log('info', `Opened ${app} with project: ${projectPath}`);
}
```

### Inject Prompt

```typescript
async function injectPrompt(prompt: string, waitForComplete: boolean, timeout: number) {
  // Write prompt to injection file
  const injectionFile = path.join(os.tmpdir(), 'agent-os-injection.txt');
  fs.writeFileSync(injectionFile, prompt);
  
  // Monitor for completion
  const startTime = Date.now();
  const checkInterval = 5000;
  
  while (waitForComplete && (Date.now() - startTime < timeout)) {
    // Check for completion marker
    const statusFile = path.join(os.tmpdir(), 'agent-os-status.json');
    if (fs.existsSync(statusFile)) {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
      if (status.completed) {
        log('info', 'Cline/Antigravity work completed', { result: status.result });
        return status;
      }
    }
    
    await sleep(checkInterval);
  }
  
  log('info', 'Cline/Antigravity task submitted, monitoring...');
}
```

## Output Streaming

Cline/Antigravity output được stream về Control Plane qua WebSocket:

```typescript
// Monitor output file
const outputFile = path.join(os.tmpdir(), 'agent-os-output.log');

// Tail the file
async function streamOutput() {
  let position = 0;
  
  while (true) {
    const stats = fs.statSync(outputFile);
    if (stats.size > position) {
      const newContent = fs.readFileSync(outputFile, 'utf-8').slice(position);
      position = stats.size;
      
      // Stream to Control Plane
      if (newContent.trim()) {
        log('info', newContent.trim());
      }
    }
    await sleep(1000);
  }
}
```

## Error Handling

| Error | Handling |
|-------|----------|
| App not found | Log warning, try alternative path |
| Project not found | Return error, don't proceed |
| Prompt injection failed | Retry 3 times, then fail |
| Timeout | Stop monitoring, return partial result |
| Output stream broken | Attempt reconnection |

## Security

- Chỉ L2+ workers được phép dùng cline control
- Mọi action đều được audit log
- Prompt được validate trước khi inject
- Output không chứa credentials

## Example Task Flow

```json
// 1. CEO creates task
{
  "type": "cline_control",
  "project": "E:\\Project\\Master\\Agent\\agent-coding",
  "payload": {
    "action": "open",
    "app": "antigravity",
    "project": "E:\\Project\\Master\\Agent\\agent-coding"
  }
}

// 2. Worker opens Antigravity
// 3. CEO creates follow-up task
{
  "type": "cline_control",
  "payload": {
    "action": "inject_prompt",
    "prompt": "Review the closed-loop agency workflow and suggest improvements",
    "waitForComplete": true,
    "timeout": 7200
  }
}

// 4. Worker injects prompt
// 5. Antigravity works on task
// 6. Logs stream in real-time
// 7. Completion detected, results captured
```
