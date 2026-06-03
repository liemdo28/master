# Agent OS - Worker Executors

## Overview

Mỗi Executor xử lý một loại task cụ thể với permission checking và audit logging riêng.

## Executor List

```
Agent Worker
│
├── File Executor      → File operations
├── Git Executor       → Git operations
├── Build Executor     → Build/compile
├── QA Executor        → Tests
├── App Executor       → Open apps
├── Script Executor    → Run scripts
├── Cline Executor     → Control Cline
├── API Proxy Executor → API proxy
└── Cloud Executor     → Cloud operations
```

## 1. File Executor

```typescript
class FileExecutor {
  async execute(task: Task): Promise<Result> {
    const { operation, path, content } = task.payload;
    
    switch (operation) {
      case 'read':
        return await this.readFile(path);
      case 'write':
        return await this.writeFile(path, content);
      case 'list':
        return await this.listDir(path);
      case 'search':
        return await this.searchFiles(path, task.payload.pattern);
      case 'stats':
        return await this.getStats(path);
    }
  }
  
  async readFile(path: string): Promise<string> {
    // Check permission
    if (!this.hasPermission('filesystem:read')) {
      throw new PermissionDenied('filesystem:read');
    }
    
    // Check path safety
    if (!this.isPathAllowed(path)) {
      throw new PathNotAllowed(path);
    }
    
    const content = fs.readFileSync(path, 'utf-8');
    await this.audit.log('file:read', path, 'success');
    return content;
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    if (!this.hasPermission('filesystem:write')) {
      throw new PermissionDenied('filesystem:write');
    }
    
    // Only allow E:\Project\Master
    if (!path.startsWith('E:\\Project\\Master')) {
      throw new PathNotAllowed(path);
    }
    
    fs.writeFileSync(path, content);
    await this.audit.log('file:write', path, 'success');
  }
}
```

## 2. Git Executor

```typescript
class GitExecutor {
  async execute(task: Task): Promise<Result> {
    const { operation, project, branch, message } = task.payload;
    
    switch (operation) {
      case 'status':
        return await this.status(project);
      case 'log':
        return await this.log(project, 10);
      case 'pull':
        return await this.pull(project);
      case 'fetch':
        return await this.fetch(project);
      case 'add':
        return await this.add(project, task.payload.files);
      case 'commit':
        return await this.commit(project, message);
      case 'push':
        return await this.push(project, branch);
      case 'status_all':
        return await this.statusAllProjects();
    }
  }
  
  async status(project: string): Promise<string> {
    const result = await this.exec(`git status --short`, project);
    return result.stdout;
  }
  
  async push(project: string, branch: string): Promise<void> {
    // Check permission
    if (!this.hasPermission('git:push')) {
      throw new PermissionDenied('git:push requires L2');
    }
    
    // Check if pushing to protected branch
    if (['main', 'master', 'production'].includes(branch)) {
      throw new ProtectedBranchError(branch);
    }
    
    // Require CHANGE_SUMMARY.md
    const summaryPath = path.join(project, 'CHANGE_SUMMARY.md');
    if (!fs.existsSync(summaryPath)) {
      throw new MissingChangeSummary();
    }
    
    await this.exec(`git push origin ${branch}`, project);
    await this.audit.log('git:push', project, 'success');
  }
  
  async statusAllProjects(): Promise<GitStatus[]> {
    const projects = await this.discoverGitProjects([
      'E:\\Project\\Master',
      'D:\\',
    ]);
    
    const results: GitStatus[] = [];
    
    for (const project of projects) {
      try {
        const status = await this.status(project);
        const log = await this.exec(`git log -1 --format="%H|%s|%an|%ai"`, project);
        
        results.push({
          path: project,
          isGit: true,
          status: status.trim(),
          hasChanges: status.trim().length > 0,
          lastCommit: log.stdout.trim(),
        });
      } catch {
        results.push({ path: project, isGit: false });
      }
    }
    
    return results;
  }
}
```

## 3. Build Executor

```typescript
class BuildExecutor {
  async execute(task: Task): Promise<BuildResult> {
    const { project, options } = task.payload;
    
    const results: BuildResult = {
      project,
      steps: [],
      success: true,
      logs: [],
    };
    
    // Step 1: Git Pull
    if (options?.gitPull !== false) {
      const pullResult = await this.exec('git pull', project);
      results.steps.push({ name: 'git_pull', success: pullResult.exitCode === 0 });
      results.logs.push(pullResult.stdout);
    }
    
    // Step 2: Install Dependencies
    const packageJson = path.join(project, 'package.json');
    if (fs.existsSync(packageJson)) {
      const installResult = await this.exec('npm install', project);
      results.steps.push({ name: 'npm_install', success: installResult.exitCode === 0 });
      results.logs.push(installResult.stdout);
      results.success = results.success && installResult.exitCode === 0;
    }
    
    // Step 3: Run Tests
    if (options?.runTests) {
      const testResult = await this.exec('npm test', project);
      results.steps.push({ name: 'tests', success: testResult.exitCode === 0 });
      results.logs.push(testResult.stdout);
      results.success = results.success && testResult.exitCode === 0;
    }
    
    // Step 4: Build
    const buildResult = await this.exec('npm run build', project);
    results.steps.push({ name: 'build', success: buildResult.exitCode === 0 });
    results.logs.push(buildResult.stdout);
    results.success = results.success && buildResult.exitCode === 0;
    
    await this.audit.log('build', project, results.success ? 'success' : 'failed');
    
    return results;
  }
}
```

## 4. QA Executor

```typescript
class QAExecutor {
  async execute(task: Task): Promise<QAResult> {
    const { project, options } = task.payload;
    
    const results: QAResult = {
      project,
      timestamp: new Date().toISOString(),
      tests: [],
      screenshots: [],
    };
    
    // Check for Playwright
    if (fs.existsSync(path.join(project, 'playwright.config'))) {
      const result = await this.exec('npx playwright test --reporter=json', project);
      results.tests.push({
        type: 'playwright',
        exitCode: result.exitCode,
        output: result.stdout,
      });
    }
    
    // Check for Cypress
    if (fs.existsSync(path.join(project, 'cypress'))) {
      const result = await this.exec('npx cypress run --reporter=json', project);
      results.tests.push({
        type: 'cypress',
        exitCode: result.exitCode,
        output: result.stdout,
      });
    }
    
    // Unit tests
    if (fs.existsSync(path.join(project, 'package.json'))) {
      const result = await this.exec('npm test 2>&1', project);
      results.tests.push({
        type: 'unit',
        exitCode: result.exitCode,
        output: result.stdout,
      });
    }
    
    // Save report
    const reportPath = path.join(project, 'reports', `qa-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    
    return results;
  }
}
```

## 5. App Executor

```typescript
class AppExecutor {
  readonly APPROVED_APPS = [
    'code', 'cursor', 'chrome', 'msedge', 'firefox',
    'wt', 'bash', 'docker', 'github', 'postman',
    'explorer', 'notepad',
  ];
  
  readonly BLOCKED_APPS = [
    'whatsapp', 'viber', 'zalo', 'telegram', 'discord', 'skype',
  ];
  
  async execute(task: Task): Promise<void> {
    const { action, app, path } = task.payload;
    
    if (action === 'open') {
      await this.openApp(app, path);
    } else if (action === 'close') {
      await this.closeApp(app);
    }
  }
  
  async openApp(app: string, targetPath?: string): Promise<void> {
    const normalized = app.toLowerCase();
    
    if (this.BLOCKED_APPS.includes(normalized)) {
      throw new BlockedAppError(app);
    }
    
    if (!this.APPROVED_APPS.includes(normalized)) {
      throw new UnknownAppError(app);
    }
    
    const cmd = targetPath 
      ? `start "" ${app} "${targetPath}"`
      : `start "" ${app}`;
    
    await this.exec(cmd, process.cwd());
    await this.audit.log('app:open', `${app} ${targetPath || ''}`, 'success');
  }
}
```

## 6. Script Executor

```typescript
class ScriptExecutor {
  readonly APPROVED_SCRIPTS = [
    '*.build.ps1',
    '*.build.bat',
    '*.test.ps1',
    '*.deploy.ps1',
    'start-proxy*.bat',
  ];
  
  async execute(task: Task): Promise<ScriptResult> {
    const { script, args, cwd } = task.payload;
    
    // Check if script is approved
    if (!this.isScriptApproved(script)) {
      throw new UnapprovedScriptError(script);
    }
    
    // Execute
    const result = await this.exec(`${script} ${args.join(' ')}`, cwd);
    
    return {
      script,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}
```

## 7. Cline Executor

```typescript
class ClineExecutor {
  async execute(task: Task): Promise<void> {
    const { action, app, project, prompt, timeout } = task.payload;
    
    switch (action) {
      case 'open':
        await this.openApp(app, project);
        break;
      case 'inject':
        await this.injectPrompt(prompt, timeout);
        break;
      case 'status':
        return await this.getStatus();
    }
  }
  
  async injectPrompt(prompt: string, timeout: number): Promise<void> {
    // Write to injection file
    const injectionFile = path.join(os.tmpdir(), 'agent-os-injection.txt');
    fs.writeFileSync(injectionFile, prompt);
    
    // Monitor for completion
    await this.monitorOutput(timeout);
  }
}
```

## 8. API Proxy Executor

```typescript
class APIProxyExecutor {
  readonly PROXY_SCRIPT = 'E:\\Project\\Master\\Agent\\agent-coding-api-keys\\start-proxy-win.bat';
  
  async execute(task: Task): Promise<ProxyStatus> {
    const { action } = task.payload;
    
    switch (action) {
      case 'start':
        return await this.startProxy();
      case 'stop':
        return await this.stopProxy();
      case 'status':
        return await this.getProxyStatus();
      case 'restart':
        await this.stopProxy();
        return await this.startProxy();
    }
  }
  
  async startProxy(): Promise<ProxyStatus> {
    // Check if already running
    const existing = await this.findProcessByPort(8080);
    if (existing) {
      return { running: true, pid: existing.pid };
    }
    
    // Start proxy
    await this.exec(`start /B cmd /c "${this.PROXY_SCRIPT}"`, process.cwd());
    
    // Wait for startup
    await this.waitForPort(8080, 30000);
    
    return { running: true, port: 8080 };
  }
}
```

## 9. Cloud Executor (Placeholder for L3)

```typescript
class CloudExecutor {
  // All operations blocked by default until L3 tokens configured
  
  async execute(task: Task): Promise<void> {
    throw new PermissionDenied('Cloud operations require Level 3 permission');
  }
}
```

## Executor Registry

```typescript
const EXECUTORS: Record<string, Executor> = {
  file: new FileExecutor(),
  git: new GitExecutor(),
  build: new BuildExecutor(),
  qa: new QAExecutor(),
  app: new AppExecutor(),
  script: new ScriptExecutor(),
  cline: new ClineExecutor(),
  api_proxy: new APIProxyExecutor(),
  cloud: new CloudExecutor(),
};

async function executeTask(task: Task): Promise<Result> {
  const executor = EXECUTORS[task.executor];
  if (!executor) {
    throw new UnknownExecutor(task.executor);
  }
  
  return await executor.execute(task);
}
```
