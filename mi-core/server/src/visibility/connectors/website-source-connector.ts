import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const VISIBILITY_WEBSITE_DIR = path.join(GLOBAL_DIR, 'visibility', 'websites');

export interface WebsiteSourceConfig {
  connector_id: 'website-bakudan' | 'website-raw';
  key: 'bakudan' | 'raw';
  website: string;
  local_source_path: string;
  production_domain: string;
  owner: string;
}

export interface WebsiteSourceSnapshot {
  connector_id: string;
  synced_at: string;
  status: 'ok' | 'not_found' | 'error';
  website: string;
  local_source_path: string;
  production_domain: string;
  github_repository: string;
  branch: string;
  last_commit: {
    sha: string;
    committed_at: string;
    subject: string;
  };
  deploy_method: string;
  deploy_files: string[];
  inventory: {
    pages: string[];
    components: string[];
    assets: string[];
    routes: string[];
    seo_files: string[];
    configs: string[];
    deployment_files: string[];
    docs: string[];
    package_files: string[];
    env_templates: string[];
  };
  entities: Array<{ type: string; name: string; attributes: Record<string, unknown> }>;
  relationships: Array<{ from: string; relation: string; to: string }>;
  risks: string[];
  secret_files_excluded: string[];
  summary_text: string;
  // Sprint 2.3: Deep sync additions
  live_site_status: 'online' | 'offline' | 'unknown';
  live_site_checked_at: string | null;
  astro_build_status: 'built' | 'not_built' | 'unknown';
  astro_last_build: string | null;
  astro_build_path: string | null;
}

const WEBSITE_CONFIGS: WebsiteSourceConfig[] = [
  {
    connector_id: 'website-bakudan',
    key: 'bakudan',
    website: 'bakudanramen.com',
    local_source_path: process.env.BAKUDAN_WEBSITE_ROOT || 'D:/Project/Master/Bakudan/bakudanramen.com-current',
    production_domain: 'https://bakudanramen.com',
    owner: 'Dev2 / Bakudan Web',
  },
  {
    connector_id: 'website-raw',
    key: 'raw',
    website: 'rawsushibar.com',
    local_source_path: process.env.RAW_WEBSITE_ROOT || 'D:/Project/Master/RawSushi/RawWebsite',
    production_domain: 'https://rawsushibar.com',
    owner: 'Dev2 / Raw Sushi Web',
  },
];

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.astro',
  '.wrangler',
  '.local-agent',
  '.claude',
]);

const SECRET_FILE_RE = /(^|\/)(\.env$|\.env\.(?!example|template)[^/]+$|\.htpasswd$|.*secret.*|.*credential.*|.*token.*)/i;

function toPosix(p: string) {
  return p.replace(/\\/g, '/');
}

function runGit(root: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', timeout: 8000 }).trim();
  } catch {
    return '';
  }
}

function readText(root: string, rel: string): string {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf-8');
  } catch {
    return '';
  }
}

function walkFiles(root: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, full));
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (SECRET_FILE_RE.test(rel)) continue;
      files.push(rel);
    }
  }

  walk(root);
  return files.sort();
}

function classifyInventory(root: string, files: string[]): WebsiteSourceSnapshot['inventory'] {
  const pages = files.filter(f =>
    /(^|\/)(src\/pages|pages|content|rawwebsite)\//.test(f) && /\.(astro|html|md|mdx|tsx|jsx)$/i.test(f) ||
    /^[^/]+\.html$/i.test(f)
  );
  const components = files.filter(f => /(^|\/)(src\/components|components|lib\/components)\//.test(f) && /\.(astro|tsx|jsx|ts|js)$/i.test(f));
  const assets = files.filter(f => /(^|\/)(public|assets|images|css|js|uploads|Bakudan Photo|Bakudan Photos 2026)\//i.test(f) && /\.(png|jpe?g|webp|gif|svg|css|js|ico|pdf)$/i.test(f));
  const routes = Array.from(new Set(pages.map(pageToRoute))).sort();
  const seoFiles = files.filter(f => /(^|\/)(robots\.txt|sitemap\.xml|.*seo.*|.*schema.*|.*metadata.*)$/i.test(f));
  const configs = files.filter(f => /(^|\/)(package\.json|astro\.config\.mjs|vite\.config\.[jt]s|wrangler\.(toml|jsonc)|tsconfig\.json|\.htaccess|_redirects)$/i.test(f));
  const deploymentFiles = files.filter(f => /^\.github\/workflows\//.test(f) || /(^|\/)(wrangler\.(toml|jsonc)|_redirects|netlify\.toml|vercel\.json)$/i.test(f));
  const docs = files.filter(f => /(^|\/)(README|PROJECT_DNA|ACTION-ITEMS|docs\/|reports\/).*\.?([A-Z]+|md|txt)?$/i.test(f) && /\.(md|txt)$/i.test(f));
  const packageFiles = files.filter(f => /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(f));
  const envTemplates = files.filter(f => /(^|\/)\.env\.(example|template)$/i.test(f));

  return {
    pages,
    components,
    assets,
    routes,
    seo_files: seoFiles,
    configs,
    deployment_files: deploymentFiles,
    docs,
    package_files: packageFiles,
    env_templates: envTemplates,
  };

  function pageToRoute(file: string) {
    const parsed = path.posix.parse(file);
    if (parsed.base === 'index.html' || parsed.base === 'index.astro') return '/';
    if (/^[^/]+\.html$/i.test(file)) return `/${parsed.name}`;
    return `/${file.replace(/^src\/pages\//, '').replace(/^pages\//, '').replace(/\.(astro|html|md|mdx|tsx|jsx)$/i, '').replace(/\/index$/, '')}`;
  }
}

function detectDeployMethod(root: string, inventory: WebsiteSourceSnapshot['inventory']): string {
  const workflowText = inventory.deployment_files
    .filter(f => f.startsWith('.github/workflows/'))
    .map(f => readText(root, f))
    .join('\n');
  if (/appleboy\/scp-action/i.test(workflowText)) return 'GitHub Actions SCP deploy to server target directory';
  if (/api\/scheduler\/run/i.test(workflowText)) return 'GitHub Actions scheduled publish API';
  if (inventory.deployment_files.some(f => /wrangler/i.test(f))) return 'Cloudflare Pages/Workers via Wrangler configuration';
  return inventory.deployment_files.length ? 'GitHub Actions / deploy config present' : 'No deploy config detected';
}

async function buildSnapshot(config: WebsiteSourceConfig): Promise<WebsiteSourceSnapshot> {
  const now = new Date().toISOString();
  const root = config.local_source_path;

  if (!fs.existsSync(root)) {
    return {
      connector_id: config.connector_id,
      synced_at: now,
      status: 'not_found',
      website: config.website,
      local_source_path: root,
      production_domain: config.production_domain,
      github_repository: '',
      branch: '',
      last_commit: { sha: '', committed_at: '', subject: '' },
      deploy_method: 'unknown',
      deploy_files: [],
      inventory: { pages: [], components: [], assets: [], routes: [], seo_files: [], configs: [], deployment_files: [], docs: [], package_files: [], env_templates: [] },
      entities: [],
      relationships: [],
      risks: [`Local source path not found: ${root}`],
      secret_files_excluded: [],
      summary_text: `${config.website}: source not found at ${root}`,
      live_site_status: 'unknown',
      live_site_checked_at: null,
      astro_build_status: 'unknown',
      astro_last_build: null,
      astro_build_path: null,
    };
  }

  const files = walkFiles(root);
  const inventory = classifyInventory(root, files);
  const latest = runGit(root, ['log', '-1', '--format=%H%n%ci%n%s']).split('\n');
  const remote = runGit(root, ['remote', 'get-url', 'origin']);
  const branch = runGit(root, ['branch', '--show-current']);
  const deployMethod = detectDeployMethod(root, inventory);
  const excludedSecrets = collectExcludedSecretFiles(root);
  const risks: string[] = [];
  if (!remote) risks.push('GitHub origin remote missing');
  if (!branch) risks.push('Git branch unknown');
  if (inventory.pages.length === 0) risks.push('No website pages found in local source');
  if (inventory.deployment_files.length === 0) risks.push('No deployment files found');
  if (inventory.seo_files.length === 0) risks.push('No robots/sitemap/SEO files found in source');

  // Sprint 2.3: Live site HTTP ping — check if production domain is reachable
  let liveSiteStatus: WebsiteSourceSnapshot['live_site_status'] = 'unknown';
  let liveSiteCheckedAt: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(config.production_domain, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    liveSiteStatus = res.ok ? 'online' : 'offline';
    liveSiteCheckedAt = now;
  } catch {
    liveSiteStatus = 'offline';
    liveSiteCheckedAt = now;
  }

  // Sprint 2.3: Astro build status — check if dist/ folder exists
  const astroDistPath = path.join(root, 'dist');
  const astroBuildPath = path.join(root, '.astro');
  let astroBuildStatus: WebsiteSourceSnapshot['astro_build_status'] = 'unknown';
  let astroLastBuild: string | null = null;
  let astroBuildOutputPath: string | null = null;
  if (fs.existsSync(path.join(root, 'astro.config.mjs')) || fs.existsSync(path.join(root, 'astro.config.ts'))) {
    // This is an Astro project
    if (fs.existsSync(astroDistPath)) {
      astroBuildStatus = 'built';
      astroBuildOutputPath = astroDistPath;
      try {
        const stats = fs.statSync(astroDistPath);
        astroLastBuild = stats.mtime.toISOString();
      } catch { /* non-fatal */ }
    } else {
      astroBuildStatus = 'not_built';
    }
  } else {
    // Not an Astro project (plain HTML / PHP)
    if (fs.existsSync(astroDistPath)) {
      astroBuildOutputPath = astroDistPath;
      astroBuildStatus = 'built';
      try {
        const stats = fs.statSync(astroDistPath);
        astroLastBuild = stats.mtime.toISOString();
      } catch { /* non-fatal */ }
    } else {
      astroBuildStatus = 'unknown';
    }
  }

  if (liveSiteStatus === 'offline') {
    risks.push(`Live site ${config.production_domain} is offline or unreachable`);
  }

  const websiteEntity = `Website:${config.website}`;
  const sourceEntity = `LocalSource:${root}`;
  const repoEntity = `Repo:${remote || 'unknown'}`;
  const domainEntity = `Domain:${config.production_domain}`;
  const deployEntity = `DeployTarget:${deployMethod}`;

  return {
    connector_id: config.connector_id,
    synced_at: now,
    status: 'ok',
    website: config.website,
    local_source_path: root,
    production_domain: config.production_domain,
    github_repository: remote,
    branch,
    last_commit: {
      sha: latest[0] || '',
      committed_at: latest[1] || '',
      subject: latest.slice(2).join('\n') || '',
    },
    deploy_method: deployMethod,
    deploy_files: inventory.deployment_files,
    inventory,
    entities: [
      { type: 'Website', name: config.website, attributes: { owner: config.owner, production_domain: config.production_domain } },
      { type: 'Repo', name: remote || 'unknown', attributes: { branch, latest_commit: latest[0] || '' } },
      { type: 'Local Source', name: root, attributes: { pages: inventory.pages.length, assets: inventory.assets.length } },
      { type: 'Domain', name: config.production_domain, attributes: { website: config.website } },
      { type: 'Deploy Target', name: deployMethod, attributes: { deploy_files: inventory.deployment_files } },
      { type: 'Owner', name: config.owner, attributes: { website: config.website } },
    ],
    relationships: [
      { from: websiteEntity, relation: 'has_source', to: sourceEntity },
      { from: websiteEntity, relation: 'syncs_to', to: repoEntity },
      { from: websiteEntity, relation: 'deploys_to', to: domainEntity },
      { from: websiteEntity, relation: 'uses_deploy_target', to: deployEntity },
      { from: `Owner:${config.owner}`, relation: 'owns', to: websiteEntity },
    ],
    risks,
    secret_files_excluded: excludedSecrets,
    summary_text: `${config.website}: ${inventory.pages.length} pages, ${inventory.assets.length} assets, repo ${remote || 'unknown'}, branch ${branch || 'unknown'}, site ${liveSiteStatus}, synced ${now}`,
    // Sprint 2.3: Deep sync fields
    live_site_status: liveSiteStatus,
    live_site_checked_at: liveSiteCheckedAt,
    astro_build_status: astroBuildStatus,
    astro_last_build: astroLastBuild,
    astro_build_path: astroBuildOutputPath,
  };
}

function collectExcludedSecretFiles(root: string): string[] {
  const secretFiles: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, full));
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (SECRET_FILE_RE.test(rel)) secretFiles.push(rel);
    }
  }
  walk(root);
  return secretFiles.sort();
}

function writeSnapshot(config: WebsiteSourceConfig, snapshot: WebsiteSourceSnapshot) {
  const dir = path.join(VISIBILITY_WEBSITE_DIR, config.key);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(dir, 'entities.json'), JSON.stringify({ entities: snapshot.entities, relationships: snapshot.relationships }, null, 2));
  fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify(snapshot.inventory, null, 2));
  fs.writeFileSync(path.join(dir, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }, null, 2));
}

export async function syncWebsiteSource(connectorId: 'website-bakudan' | 'website-raw'): Promise<WebsiteSourceSnapshot> {
  const config = WEBSITE_CONFIGS.find(c => c.connector_id === connectorId);
  if (!config) throw new Error(`Unknown website connector: ${connectorId}`);
  const snapshot = await buildSnapshot(config);
  if (snapshot.status !== 'ok') throw new Error(snapshot.risks.join('; ') || `${config.website} sync failed`);
  writeSnapshot(config, snapshot);
  return snapshot;
}

export async function syncWebsiteSources(): Promise<Record<string, WebsiteSourceSnapshot>> {
  const bakudan = await syncWebsiteSource('website-bakudan');
  const raw = await syncWebsiteSource('website-raw');
  return { bakudan, raw };
}

export function getCachedWebsiteSource(key: 'bakudan' | 'raw'): WebsiteSourceSnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(VISIBILITY_WEBSITE_DIR, key, 'data.json'), 'utf-8'));
  } catch {
    return null;
  }
}

export function getWebsiteSourceAnswer(question: string): { answer: string; evidence: unknown[]; confidence: number; gaps: string[] } | null {
  const q = question.toLowerCase();
  const bakudan = getCachedWebsiteSource('bakudan');
  const raw = getCachedWebsiteSource('raw');
  const sites = [bakudan, raw].filter(Boolean) as WebsiteSourceSnapshot[];

  if (!/(bakudan|raw|website|domain|source|repo|github|deploy|sync)/.test(q)) return null;
  if (!sites.length) {
    return {
      answer: 'No synced website source data found yet. Run /api/visibility/sync/website-bakudan and /api/visibility/sync/website-raw first.',
      evidence: [],
      confidence: 20,
      gaps: ['Website source cache is empty'],
    };
  }

  if (/source.*bakudan|bakudan.*source|bakudan.*ở đâu|bakudan.*o dau/.test(q) && bakudan) {
    return { answer: `Source của bakudanramen.com nằm ở ${bakudan.local_source_path}.`, evidence: [bakudan], confidence: 95, gaps: [] };
  }

  if (/source.*raw|raw.*source|raw.*ở đâu|raw.*o dau/.test(q) && raw) {
    return { answer: `Source của rawsushibar.com nằm ở ${raw.local_source_path}.`, evidence: [raw], confidence: 95, gaps: [] };
  }

  if (/bakudan.*bao nhiêu.*page|bakudan.*bao nhieu.*page|bakudan.*page/.test(q) && bakudan) {
    const primaryPages = bakudan.inventory.pages.filter(p => /^[^/]+\.html$/i.test(p));
    return {
      answer: `Bakudan website có ${primaryPages.length} page chính trong local source sync.`,
      evidence: [{ primary_pages: primaryPages, all_synced_pages: bakudan.inventory.pages }],
      confidence: 92,
      gaps: [],
    };
  }

  if (/raw.*sync.*lần cuối|raw.*sync.*lan cuoi|raw.*last sync/.test(q) && raw) {
    return { answer: `Raw Sushi website sync lần cuối lúc ${raw.synced_at}.`, evidence: [raw], confidence: 95, gaps: [] };
  }

  if (/domain.*lỗi|domain.*loi|domain.*error|kiểm tra source|kiem tra source/.test(q)) {
    return {
      answer: 'Nếu domain lỗi, kiểm tra theo thứ tự: production domain HTTP snapshot trước, rồi GitHub workflow/deploy target, rồi local source nếu deploy dùng commit cũ hoặc source thiếu asset/page.',
      evidence: sites.map(s => ({ website: s.website, source: s.local_source_path, repo: s.github_repository, deploy_method: s.deploy_method, domain: s.production_domain })),
      confidence: 85,
      gaps: [],
    };
  }

  if (/repo|github|deploy từ|deploy tu/.test(q)) {
    return {
      answer: sites.map(s => `${s.website} deploys from ${s.github_repository || 'unknown repo'} (${s.branch || 'unknown branch'}) via ${s.deploy_method}.`).join(' '),
      evidence: sites,
      confidence: 90,
      gaps: sites.flatMap(s => s.github_repository ? [] : [`${s.website} repo missing`]),
    };
  }

  return {
    answer: `Website source cache has ${sites.length} synced site(s): ${sites.map(s => `${s.website} (${s.inventory.pages.length} pages)`).join(', ')}.`,
    evidence: sites,
    confidence: 80,
    gaps: [],
  };
}
