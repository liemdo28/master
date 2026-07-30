#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const defaultOutDir = join(repoRoot, '.mi-harness');

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(harnessDir, relativePath), 'utf8'));
}

function readText(kind, id) {
  const filePath = join(harnessDir, kind, `${id}.md`);
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${kind} file for id: ${id}`);
  }
  return readFileSync(filePath, 'utf8').trim();
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        index += 1;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function unique(values) {
  return [...new Set(values)];
}

export function resolvePlan(profileId = 'core') {
  const { profiles } = readJson('manifests/profiles.json');
  const { modules } = readJson('manifests/modules.json');
  const profile = profiles[profileId];
  if (!profile) {
    throw new Error(`Unknown profile "${profileId}". Available: ${Object.keys(profiles).join(', ')}`);
  }

  const resolvedModules = profile.modules.map((moduleId) => {
    const module = modules[moduleId];
    if (!module) {
      throw new Error(`Profile "${profileId}" references unknown module "${moduleId}"`);
    }
    return { id: moduleId, ...module };
  });

  return {
    profile: { id: profileId, ...profile },
    modules: resolvedModules,
    skills: unique(resolvedModules.flatMap((module) => module.skills || [])),
    rules: unique(resolvedModules.flatMap((module) => module.rules || [])),
    commands: unique(resolvedModules.flatMap((module) => module.commands || [])),
  };
}

export function listCatalog() {
  const { profiles } = readJson('manifests/profiles.json');
  const { modules } = readJson('manifests/modules.json');
  return { profiles, modules };
}

function printCatalog() {
  const { profiles, modules } = listCatalog();
  console.log('Profiles:');
  for (const [id, profile] of Object.entries(profiles)) {
    console.log(`- ${id}: ${profile.description}`);
  }
  console.log('\nModules:');
  for (const [id, module] of Object.entries(modules)) {
    console.log(`- ${id}: ${module.description}`);
  }
}

export function formatPlan(plan, json = false) {
  if (json) {
    return JSON.stringify(plan, null, 2);
  }

  const lines = [
    `Profile: ${plan.profile.id}`,
    `Description: ${plan.profile.description}`,
    '',
    'Modules:',
  ];
  for (const module of plan.modules) {
    lines.push(`- ${module.id}: ${module.description}`);
  }
  lines.push('');
  lines.push(`Skills: ${plan.skills.join(', ')}`);
  lines.push(`Rules: ${plan.rules.join(', ')}`);
  lines.push(`Commands: ${plan.commands.join(', ')}`);
  return lines.join('\n');
}

function writeCollection(outDir, kind, ids) {
  const targetDir = join(outDir, kind);
  mkdirSync(targetDir, { recursive: true });
  for (const id of ids) {
    writeFileSync(join(targetDir, `${id}.md`), `${readText(kind, id)}\n`, 'utf8');
  }
}

export function materialize(plan, outDir = defaultOutDir) {
  const resolvedOut = resolve(outDir);
  if (!resolvedOut.startsWith(repoRoot)) {
    throw new Error(`Refusing to write outside mi-core: ${resolvedOut}`);
  }

  if (existsSync(resolvedOut)) {
    rmSync(resolvedOut, { recursive: true, force: true });
  }
  mkdirSync(resolvedOut, { recursive: true });

  writeFileSync(join(resolvedOut, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  writeCollection(resolvedOut, 'skills', plan.skills);
  writeCollection(resolvedOut, 'rules', plan.rules);
  writeCollection(resolvedOut, 'commands', plan.commands);

  const summary = [
    '# Mi Harness Context',
    '',
    `Profile: ${plan.profile.id}`,
    '',
    '## Modules',
    ...plan.modules.map((module) => `- ${module.id}: ${module.description}`),
    '',
    '## Skills',
    ...plan.skills.map((id) => `- ${id}`),
    '',
    '## Rules',
    ...plan.rules.map((id) => `- ${id}`),
    '',
    '## Commands',
    ...plan.commands.map((id) => `- ${id}`),
    '',
  ].join('\n');

  writeFileSync(join(resolvedOut, 'README.md'), summary, 'utf8');
  return {
    ok: true,
    profile: plan.profile.id,
    outDir: resolvedOut,
    skills: plan.skills.length,
    rules: plan.rules.length,
    commands: plan.commands.length,
  };
}

function readOptional(relativePath, maxChars = 4000) {
  const filePath = join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8').slice(0, maxChars);
}

function newestReports(limit = 8) {
  const candidates = [];
  for (const dir of [repoRoot, join(repoRoot, 'reports'), join(repoRoot, 'security')]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!/(_REPORT|_REVIEW|_VALIDATION|_AUDIT)\.md$/i.test(name)) continue;
      const fullPath = join(dir, name);
      const stat = statSync(fullPath);
      candidates.push({
        file: fullPath.replace(`${repoRoot}\\`, '').replaceAll('\\', '/'),
        modified: stat.mtime.toISOString(),
        title: name.replace(/\.md$/i, ''),
      });
    }
  }
  return candidates
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, limit);
}

function packageScripts() {
  const packages = ['package.json', 'server/package.json', 'agent-engine/package.json', 'mi-remote-agent/package.json'];
  return packages
    .map((relativePath) => {
      const raw = readOptional(relativePath, 20000);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        package: relativePath,
        name: parsed.name,
        scripts: parsed.scripts || {},
      };
    })
    .filter(Boolean);
}

function gitStatusSummary() {
  try {
    const raw = execSync('git status --short -- mi-core', {
      cwd: resolve(repoRoot, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return {
      changedCount: lines.length,
      sample: lines.slice(0, 40),
      truncated: lines.length > 40,
    };
  } catch (error) {
    return { error: error.message };
  }
}

function inferSurfaces(plan) {
  const surfaceByProfile = {
    whatsapp: ['server/src/routes/whatsapp.ts', 'server/src/services/whatsapp-*', 'whatsapp-ai-gateway'],
    visibility: ['local-agent/universal-visibility', 'server/src/visibility', 'ui/brain.html', 'ui/liveboard.html'],
    'daily-work': ['local-agent/action-layer', 'server/src/actions', 'server/src/approval'],
    compliance: ['server/src/knowledge', 'local-agent/knowledge-federation', '.local-agent-global/reference-brain'],
    'remote-control': ['mi-remote-agent', 'server/src/remote', 'local-agent/remote-control'],
    coding: ['agent-engine/autonomous-coding', 'agent-engine/bridge.mjs'],
    ops: ['local-agent', 'server/src/routes', 'ui'],
    core: ['MI_MASTER_ARCHITECTURE.md', 'agent-engine', 'server', 'local-agent', 'ui'],
  };
  return surfaceByProfile[plan.profile.id] || surfaceByProfile.core;
}

export function buildSmartBrief(profileId = 'core') {
  const plan = resolvePlan(profileId);
  const architecture = readOptional('MI_MASTER_ARCHITECTURE.md', 5000);
  const reports = newestReports();
  const scripts = packageScripts();
  const git = gitStatusSummary();
  const surfaces = inferSurfaces(plan);

  const text = [
    `# Mi Smart Brief: ${plan.profile.id}`,
    '',
    plan.profile.description,
    '',
    '## Affected Surfaces',
    ...surfaces.map((surface) => `- ${surface}`),
    '',
    '## Harness Modules',
    ...plan.modules.map((module) => `- ${module.id}: ${module.description}`),
    '',
    '## Recent Reports',
    ...(reports.length ? reports.map((report) => `- ${report.file} (${report.modified})`) : ['- None found']),
    '',
    '## Available Package Scripts',
    ...scripts.flatMap((pkg) => {
      const names = Object.keys(pkg.scripts);
      return [`- ${pkg.package} (${pkg.name || 'unnamed'}): ${names.length ? names.join(', ') : 'no scripts'}`];
    }),
    '',
    '## Git Working State',
    `- Changed files under mi-core: ${git.changedCount ?? 'unknown'}`,
    ...(git.sample || []).map((line) => `- ${line}`),
    git.truncated ? '- ...truncated' : '',
    '',
    '## Architecture Excerpt',
    architecture ? architecture.split(/\r?\n/).slice(0, 40).join('\n') : 'MI_MASTER_ARCHITECTURE.md not found.',
    '',
  ].filter(Boolean).join('\n');

  return {
    profile: plan.profile.id,
    generatedAt: new Date().toISOString(),
    plan,
    surfaces,
    reports,
    scripts,
    git,
    architectureExcerpt: architecture,
    text,
  };
}

function usage() {
  console.log(`Mi Operator Harness

Usage:
  node agent-engine/operator-harness/mi-harness.mjs list
  node agent-engine/operator-harness/mi-harness.mjs plan [--profile core] [--json]
  node agent-engine/operator-harness/mi-harness.mjs brief [--profile core] [--json]
  node agent-engine/operator-harness/mi-harness.mjs materialize [--profile core] [--out .mi-harness]
`);
}

function isMain() {
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0] || 'plan';
    const profile = args.profile || 'core';

    if (command === 'list') {
      printCatalog();
    } else if (command === 'plan') {
      console.log(formatPlan(resolvePlan(profile), Boolean(args.json)));
    } else if (command === 'brief') {
      const brief = buildSmartBrief(profile);
      console.log(args.json ? JSON.stringify(brief, null, 2) : brief.text);
    } else if (command === 'materialize') {
      const result = materialize(resolvePlan(profile), args.out || defaultOutDir);
      console.log(`Materialized ${result.profile} harness context at ${result.outDir}`);
    } else if (command === 'help' || command === '--help' || command === '-h') {
      usage();
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`[mi-harness] ${error.message}`);
    process.exit(1);
  }
}
