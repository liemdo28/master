// ============================================================
// Agent OS - Worker - Task Handlers
// ============================================================

import { execCommand, log, CONTROL_URL, workerToken, workerId, currentTaskId } from '../worker';
import axios from 'axios';
import { handleCline } from './cline.handler';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { createAgentHandoff } from './agentAdapters';

const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));
const APPROVED_SCRIPT_PATHS = new Set([
  path.resolve(MASTER_ROOT, 'Agent', 'agent-coding-api-keys', 'start-proxy-background.ps1').toLowerCase(),
]);

function resolveProjectPath(project: string): string {
  if (path.isAbsolute(project)) return project;
  return path.resolve(MASTER_ROOT, project);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isWindowsProcessRunning(imageName: string): boolean {
  try {
    const output = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf-8',
      windowsHide: true,
    });
    return output.toLowerCase().includes(imageName.toLowerCase());
  } catch {
    return false;
  }
}

// Helper to report progress
async function reportProgress(taskId: string, progress: number, message: string) {
  try {
    await axios.post(`${CONTROL_URL}/api/tasks/${taskId}/progress`, {
      progress,
      message,
    }, {
      headers: { 'x-worker-token': workerToken },
    });
  } catch {}
}

// ============================================================
// BUILD HANDLER
// ============================================================
export async function handleBuild(task: any) {
  const { payload } = task;
  const project = resolveProjectPath(task.project);
  log('info', `Building project: ${project}`);
  
  // Validate project exists
  if (!fs.existsSync(project)) {
    throw new Error(`Project not found: ${project}`);
  }
  
  const packageJson = path.join(project, 'package.json');
  const hasNpm = fs.existsSync(packageJson);
  const hasComposer = fs.existsSync(path.join(project, 'composer.json'));
  const hasRequirements = fs.existsSync(path.join(project, 'requirements.txt'));
  const hasGoMod = fs.existsSync(path.join(project, 'go.mod'));
  const hasCargo = fs.existsSync(path.join(project, 'Cargo.toml'));
  
  let buildCommand = '';
  let buildSteps: string[] = [];
  
  if (hasNpm) {
    // Node.js project
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
    log('info', `Node.js project detected: ${pkg.name || 'unnamed'}`);
    
    // Git pull if git repo
    if (fs.existsSync(path.join(project, '.git'))) {
      log('info', 'Git pull...');
      await execCommand('git pull', project);
    }
    
    // Install dependencies
    log('info', 'Installing dependencies...');
    const installResult = await execCommand('npm install', project);
    if (installResult.exitCode !== 0) {
      throw new Error(`npm install failed: ${installResult.stderr}`);
    }
    
    // Build
    if (pkg.scripts?.build) {
      log('info', 'Running build script...');
      const buildResult = await execCommand('npm run build', project);
      if (buildResult.exitCode !== 0) {
        throw new Error(`Build failed: ${buildResult.stderr}`);
      }
    } else if (pkg.scripts?.compile) {
      log('info', 'Running compile script...');
      const buildResult = await execCommand('npm run compile', project);
      if (buildResult.exitCode !== 0) {
        throw new Error(`Build failed: ${buildResult.stderr}`);
      }
    } else {
      log('info', 'No build script defined, skipping build');
    }
    
    // Run tests if configured
    if (payload?.runTests && pkg.scripts?.test) {
      log('info', 'Running tests...');
      const testResult = await execCommand('npm test', project);
      if (testResult.exitCode !== 0) {
        log('warn', 'Tests failed', { output: testResult.stdout });
      }
    }
    
  } else if (hasComposer) {
    // PHP project
    log('info', 'PHP project detected');
    await execCommand('composer install', project);
    
  } else if (hasRequirements) {
    // Python project
    log('info', 'Python project detected');
    await execCommand('pip install -r requirements.txt', project);
  }
  
  log('info', 'Build completed successfully');
}

// ============================================================
// QA HANDLER
// ============================================================
export async function handleQA(task: any) {
  const { payload } = task;
  const project = resolveProjectPath(task.project);
  log('info', `Running QA for project: ${project}`);
  
  if (!fs.existsSync(project)) {
    throw new Error(`Project not found: ${project}`);
  }
  
  const packageJson = path.join(project, 'package.json');
  const hasPlaywright = [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mjs',
    'playwright.config.cjs',
  ].some(file => fs.existsSync(path.join(project, file)));
  const hasCypress = fs.existsSync(path.join(project, 'cypress'));
  
  const results: any = {
    id: uuidv4(),
    taskId: task.id,
    timestamp: new Date().toISOString(),
    project,
    engine: 'qa-platform',
    tests: [],
  };
  
  if (hasPlaywright) {
    log('info', 'Running Playwright tests...');
    const result = await execCommand('npx playwright test --reporter=list', project);
    results.tests.push({
      type: 'playwright',
      exitCode: result.exitCode,
      output: result.stdout + result.stderr,
    });
  }
  
  if (hasCypress) {
    log('info', 'Running Cypress tests...');
    const result = await execCommand('npx cypress run', project);
    results.tests.push({
      type: 'cypress',
      exitCode: result.exitCode,
      output: result.stdout + result.stderr,
    });
  }
  
  if (fs.existsSync(packageJson)) {
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
    if (pkg.scripts?.test) {
      log('info', 'Running unit tests...');
      const result = await execCommand('npm test', project);
      results.tests.push({
        type: 'unit',
        exitCode: result.exitCode,
        output: result.stdout + result.stderr,
      });
    }
  }
  
  if (results.tests.length === 0) {
    results.tests.push({
      type: 'structure',
      exitCode: 0,
      output: 'No executable test runner detected. Structural QA completed.',
    });
  }

  // Generate report artifact outside the product tree.
  const artifactDir = path.join(MASTER_ROOT, 'qa-platform', 'artifacts', path.basename(project));
  ensureDir(artifactDir);
  const reportPath = path.join(artifactDir, `qa-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log('info', 'QA report generated', { path: reportPath });
  
  // Check if any tests failed
  const failedTests = results.tests.filter((t: any) => t.exitCode !== 0);
  if (failedTests.length > 0) {
    log('warn', `${failedTests.length} test(s) failed`);
  } else {
    log('info', 'All tests passed');
  }
}

// ============================================================
// GIT SYNC HANDLER
// ============================================================
export async function handleGitSync(task: any) {
  const { payload } = task;
  const project = resolveProjectPath(task.project);
  log('info', `Git sync for project: ${project}`);
  
  if (!fs.existsSync(project)) {
    throw new Error(`Project not found: ${project}`);
  }
  
  const gitDir = path.join(project, '.git');
  if (!fs.existsSync(gitDir)) {
    const statusAllScript = path.join(MASTER_ROOT, 'git-status-all.ps1');
    if (payload?.scope === 'all_repositories' && fs.existsSync(statusAllScript)) {
      log('info', 'Root is not a git repository; running approved all-repository status script');
      const statusResult = await execCommand(`powershell -NoProfile -ExecutionPolicy Bypass -File "${statusAllScript}"`, MASTER_ROOT);
      if (statusResult.exitCode !== 0) {
        throw new Error(`Git status all failed: ${statusResult.stderr}`);
      }
      log('info', 'Git status all completed');
      return;
    }
    throw new Error('Not a git repository');
  }
  
  const operations = payload?.operations || ['status', 'pull'];
  const results: any = {};
  
  for (const op of operations) {
    log('info', `Git operation: ${op}`);
    
    switch (op) {
      case 'status':
        const statusResult = await execCommand('git status --short', project);
        results.status = statusResult.stdout;
        log('info', `Status:\n${statusResult.stdout}`);
        break;
        
      case 'pull':
        const pullResult = await execCommand('git pull', project);
        results.pull = { exitCode: pullResult.exitCode, output: pullResult.stdout + pullResult.stderr };
        if (pullResult.exitCode !== 0) {
          log('warn', `Pull failed: ${pullResult.stderr}`);
        } else {
          log('info', 'Pull successful');
        }
        break;
        
      case 'fetch':
        await execCommand('git fetch --all', project);
        results.fetch = { success: true };
        log('info', 'Fetch successful');
        break;
        
      case 'log':
        const logResult = await execCommand('git log --oneline -10', project);
        results.log = logResult.stdout;
        log('info', `Recent commits:\n${logResult.stdout}`);
        break;
    }
  }
  
  log('info', 'Git sync completed', results);
}

// ============================================================
// AUDIT HANDLER
// ============================================================
export async function handleAudit(task: any) {
  const project = resolveProjectPath(task.project);
  log('info', `Auditing project: ${project}`);
  
  if (!fs.existsSync(project)) {
    throw new Error(`Project not found: ${project}`);
  }
  
  const auditReport: any = {
    id: uuidv4(),
    project,
    timestamp: new Date().toISOString(),
    stats: {},
    files: {},
    languages: [],
    frameworks: [],
    dependencies: {},
    security: {},
  };
  
  // Count files by extension
  const countFiles = (dir: string, pattern: RegExp): number => {
    let count = 0;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          count += countFiles(fullPath, pattern);
        } else if (pattern.test(item.name)) {
          count++;
        }
      }
    } catch {}
    return count;
  };
  
  auditReport.stats = {
    totalFiles: countFiles(project, /.*/),
    sourceFiles: countFiles(project, /\.(ts|js|tsx|jsx)$/),
    styleFiles: countFiles(project, /\.(css|scss|sass|less)$/),
    configFiles: countFiles(project, /\.(json|yaml|yml|toml|ini)$/),
    docFiles: countFiles(project, /\.(md|txt|rst)$/),
  };
  
  // Detect languages and frameworks
  if (fs.existsSync(path.join(project, 'package.json'))) {
    auditReport.languages.push('JavaScript/TypeScript');
    const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf-8'));
    auditReport.dependencies = pkg.dependencies || {};
    auditReport.frameworks = Object.keys({
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    }).filter(dep => ['react', 'vue', 'angular', 'next', 'nuxt', 'express', 'nest', 'svelte', 'electron'].some(f => dep.includes(f)));
  }
  
  if (fs.existsSync(path.join(project, 'composer.json'))) {
    auditReport.languages.push('PHP');
  }
  
  if (fs.existsSync(path.join(project, 'requirements.txt'))) {
    auditReport.languages.push('Python');
  }
  
  if (fs.existsSync(path.join(project, 'go.mod'))) {
    auditReport.languages.push('Go');
  }
  
  // Security checks
  const packageJson = path.join(project, 'package.json');
  if (fs.existsSync(packageJson)) {
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
    const deprecated = ['request', 'moment', 'request-promise'];
    auditReport.security.deprecatedPackages = Object.keys(pkg.dependencies || {}).filter(dep => deprecated.includes(dep));
  }
  
  // Check for sensitive files
  const sensitiveFiles = ['.env', '.env.local', 'config/secrets.json', 'secrets.json'];
  auditReport.security.sensitiveFilesFound = sensitiveFiles.filter(f => fs.existsSync(path.join(project, f)));
  
  // Save audit report
  const reportDir = path.join(MASTER_ROOT, 'qa-platform', 'artifacts', path.basename(project));
  ensureDir(reportDir);
  const reportPath = path.join(reportDir, `audit-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  
  log('info', 'Audit completed', {
    stats: auditReport.stats,
    languages: auditReport.languages,
    frameworks: auditReport.frameworks,
    reportPath,
  });
}

// ============================================================
// SCRIPT HANDLER
// ============================================================
export async function handleScript(task: any) {
  const { payload } = task;
  const project = resolveProjectPath(task.project);
  log('info', `Running registry script intent: ${payload?.registryIntent || 'none'}`);
  
  if (!payload?.registryIntent) {
    throw new Error('Raw shell blocked: script tasks must come from COMMAND_REGISTRY.json.');
  }

  let fullCommand = '';
  
  if (payload.scriptPath) {
    const resolvedScript = path.resolve(String(payload.scriptPath));
    if (!APPROVED_SCRIPT_PATHS.has(resolvedScript.toLowerCase())) {
      throw new Error(`Raw shell blocked: script path is not approved: ${resolvedScript}`);
    }
    fullCommand = resolvedScript.toLowerCase().endsWith('.ps1')
      ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${resolvedScript}"`
      : `"${resolvedScript}"`;
  } else if (payload.rawShellApproved === true && payload.command) {
    fullCommand = String(payload.command);
  } else {
    throw new Error('Raw shell blocked: no approved script path or explicit rawShellApproved payload.');
  }
  
  log('info', `Executing: ${fullCommand}`);
  
  const result = await execCommand(fullCommand, project);
  
  if (result.exitCode !== 0 && payload?.required !== false) {
    throw new Error(`Script failed with exit code ${result.exitCode}: ${result.stderr}`);
  }
  
  log('info', 'Script execution completed', {
    exitCode: result.exitCode,
    stdoutLength: result.stdout.length,
    stderrLength: result.stderr.length,
  });
}

// ============================================================
// LAUNCH HANDLER
// ============================================================
export async function handleLaunch(task: any) {
  const { payload } = task;
  const app = String(payload?.app || '').toLowerCase();

  if (payload?.registryIntent !== 'open_antigravity' || app !== 'antigravity') {
    throw new Error('Launch blocked: app launch must come from an approved registry intent.');
  }

  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Antigravity', 'Antigravity.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Antigravity', 'Antigravity.exe'),
  ].filter(Boolean);

  const executable = candidates.find(candidate => fs.existsSync(candidate));
  if (!executable) {
    throw new Error('Antigravity executable not found in approved install locations.');
  }

  const projectPath = resolveProjectPath(String(payload?.projectPath || task.project || MASTER_ROOT));
  const handoff = createAgentHandoff(task, 'antigravity', {
    status: 'opened_antigravity_ready_for_manual_injection',
    nativeInjection: false,
    reason: 'Antigravity native Agent Manager injection API is not exposed to this worker yet.',
  });
  const args = fs.existsSync(projectPath) ? [projectPath] : [];

  log('info', 'Launching approved app', {
    app,
    executable,
    project: task.project,
    projectPath,
    handoff,
    handoffPrompt: payload?.handoffPrompt,
  });

  if (isWindowsProcessRunning('Antigravity.exe') || isWindowsProcessRunning('Antigravity IDE.exe')) {
    log('info', 'Antigravity already running; handoff artifact generated without spawning a duplicate IDE process', {
      handoff,
    });
    return {
      adapter: 'antigravity',
      launched: false,
      alreadyRunning: true,
      pid: null,
      handoff,
      nativeInjection: false,
    };
  }

  const child = spawn(executable, args, {
    cwd: fs.existsSync(projectPath) ? projectPath : MASTER_ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  log('info', 'Launch command handed off', { pid: child.pid || null, handoff });
  return {
    adapter: 'antigravity',
    launched: true,
    pid: child.pid || null,
    handoff,
    nativeInjection: false,
  };
}


// ============================================================
// CLINE HANDLER (wrapper for cline.handler.ts)
// ============================================================
export async function handleClineTask(task: any) {
  const streamLog = (level: string, message: string, data?: any) => log(level, message, data);
  if (task.payload?.autoExecute === true) {
    await handleCline(task, streamLog);
    return {
      adapter: 'cline',
      mode: 'gateway_agent',
      autoExecute: true,
    };
  }

  const handoff = createAgentHandoff(task, 'cline', {
    status: 'ready_for_cline_extension',
    nativeInjection: false,
    reason: 'Cline VS Code extension does not expose a stable local task injection API to this worker.',
  });

  log('info', 'Cline extension handoff generated', {
    taskId: task.id,
    handoff,
  });

  return {
    adapter: 'cline',
    mode: 'extension_handoff',
    handoff,
    nativeInjection: false,
    manualAction: 'Open the Cline extension and paste PROMPT.md.',
  };
}
