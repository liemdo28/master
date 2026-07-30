// kb/unified/IngestionEngine.js — Full Unified Knowledge DB ingestion engine
// Indexes: E:\Project\Master, .local-agent-global, reports/, docs/, READMEs, package files, source-map outputs, dashboard cache, website cache, connector cache
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename, dirname, resolve } from 'path';
import ignore from 'ignore';
import fg from 'fast-glob';
import {
  openUKV, upsertProject, getProject, setMeta,
  upsertKnowledgeItem, deleteKnowledgeItemsByProject,
  upsertSourceMap, clearSourceMap,
  logIngest, getUKVStats, markProjectIndexed, markStaleProjects,
  listProjects
} from './UnifiedKnowledgeDatabase.js';

const DEFAULT_EXCLUDES = [
  '**/node_modules/**', '**/.git/**', '**/.backups/**', '**/dist/**',
  '**/build/**', '**/vendor/**', '**/cache/**', '**/tmp/**',
  '**/.gitkeep', '**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock',
  '**/__pycache__/**', '**/.DS_Store', '**/Thumbs.db',
];

// Known project config file patterns
const PACKAGE_FILES = ['package.json', 'composer.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'Gemfile', 'setup.py', 'build.gradle', 'pom.xml'];
const README_FILES = ['README.md', 'README.txt', 'Readme.md', 'readme.md'];

export class IngestionEngine {
  constructor(dbPath, { masterRoot = 'E:\\Project\\Master', localAgentGlobal = null, ukPath = null } = {}) {
    this.dbPath = dbPath;
    this.db = null;
    this.masterRoot = resolve(masterRoot);
    // Try common locations for .local-agent-global
    const selfPath = dirname(dirname(this.dbPath)); // agent-coding root
    this.localAgentGlobal = localAgentGlobal || 
      (existsSync(join(selfPath, '.local-agent-global')) ? join(selfPath, '.local-agent-global') :
       existsSync(join(masterRoot, '.local-agent-global')) ? join(masterRoot, '.local-agent-global') :
       existsSync(join(masterRoot, '..', '.local-agent-global')) ? join(masterRoot, '..', '.local-agent-global') : null);
    this.ig = ignore().add(DEFAULT_EXCLUDES);
    this.stats = { filesScanned: 0, filesIndexed: 0, projectsFound: 0, errors: [], startTime: 0 };
  }

  getDB() {
    if (!this.db) {
      this.db = openUKV(this.dbPath);
    }
    return this.db;
  }

  close() {
    if (this.db) { this.db.close(); this.db = null; }
  }

  // ── Full rebuild ──
  rebuild() {
    this.stats.startTime = Date.now();
    const db = this.getDB();
    console.log('[UKV] Starting full rebuild...');

    // 1. Discover projects from E:\Project\Master
    this._discoverProjects(db);

    // 2. Index .local-agent-global company memory, decisions, incidents
    this._indexGlobalMemory(db);

    // 3. Index reports (root-level *.md reports)
    this._indexReports(db);

    // 4. Index docs/ directory
    this._indexDocs(db);

    // 5. Index README files for each project
    this._indexReadmes(db);

    // 6. Index package config files
    this._indexPackageFiles(db);

    // 7. Index source maps from .local-agent directories
    this._indexSourceMaps(db);

    // 8. Index connector caches
    this._indexConnectors(db);

    // 9. Index the main agent-coding project (self)
    const selfRoot = resolve(join(dirname(this.dbPath), '../..'));
    if (existsSync(selfRoot)) {
      let selfProj = getProject(db, selfRoot);
      if (!selfProj) {
        selfProj = upsertProject(db, {
          root_path: selfRoot,
          name: basename(selfRoot),
          project_type: 'node',
          registry_source: 'self',
          file_count: this._countFiles(selfRoot),
        });
      }
      this._indexProject(db, selfProj);
    }

    // 10. For each discovered project, index its content
    const allProjects = listProjects(db);
    for (const proj of allProjects) {
      if (proj.root_path === selfRoot) continue; // already indexed
      console.log(`[UKV] Indexing project: ${proj.name}`);
      this._indexProject(db, proj);
    }

    // 11. Index websites
    this._indexWebsites(db);

    // 12. Index menu/SEO/content data
    this._indexSEOData();

    // 11. Mark stale projects
    const staleCount = markStaleProjects(db);
    if (staleCount > 0) console.log(`[UKV] ${staleCount} stale projects marked`);

    // 11. Set last indexed timestamp
    setMeta(db, 'last_indexed_at', new Date().toISOString());
    setMeta(db, 'last_indexed_duration_ms', String(Date.now() - this.stats.startTime));

    const finalStats = getUKVStats(db);
    logIngest(db, { kind: 'rebuild', action: 'full_rebuild', detail: JSON.stringify(finalStats), duration_ms: Date.now() - this.stats.startTime });

    console.log(`[UKV] Rebuild complete: ${finalStats.total_items} items, ${finalStats.projects} projects, ${finalStats.total_source_map} source map entries in ${((Date.now() - this.stats.startTime)/1000).toFixed(1)}s`);
    return { ...finalStats, errors: this.stats.errors.slice(0, 20) };
  }

  // ── Incremental sync ──
  incrementalSync() {
    const start = Date.now();
    const db = this.getDB();
    console.log('[UKV] Starting incremental sync...');

    // Re-check all projects for new/modified files
    const projects = listProjects(db);
    let synced = 0;
    for (const proj of projects) {
      if (!existsSync(proj.root_path)) {
        db.prepare('UPDATE projects SET stale = 1 WHERE id = ?').run(proj.id);
        continue;
      }
      // Quick mtime check — if project directory hasn't changed, skip
      const now = Date.now();
      const lastIndexed = proj.last_indexed_at ? new Date(proj.last_indexed_at).getTime() : 0;
      try {
        const rootStat = statSync(proj.root_path);
        if (rootStat.mtimeMs < lastIndexed && rootStat.ctimeMs < lastIndexed) continue;
      } catch { continue; }

      this._indexProject(db, proj);
      synced++;
    }
    setMeta(db, 'last_incremental_sync_at', new Date().toISOString());
    logIngest(db, { kind: 'sync', action: 'incremental', detail: `Synced ${synced}/${projects.length} projects`, duration_ms: Date.now() - start });
    return { synced, total: projects.length, duration_ms: Date.now() - start };
  }

  // ── Internal helpers ──

  _discoverProjects(db) {
    console.log('[UKV] Discovering projects...');
    const masterDir = this.masterRoot;
    if (!existsSync(masterDir)) { console.log(`[UKV] Master root ${masterDir} not found`); return; }

    // Walk E:\Project\Master for subdirectories that look like projects
    const entries = readdirSync(masterDir, { withFileTypes: true });
    let count = 0;
    // Broader project detection: look for package files, README, src/, apps/, .git, or just any dir with content
    const projectDirs = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith('.') || name === '_archive' || name === '_backups') continue;
      const fullPath = join(masterDir, entry.name);
      const hasPackage = PACKAGE_FILES.some(f => existsSync(join(fullPath, f)));
      const hasReadme = README_FILES.concat(['readme.md', 'Readme.md']).some(f => {
        return existsSync(join(fullPath, f));
      }) || (() => { try { return readdirSync(fullPath).some(ff => ff.toLowerCase().startsWith('readme')); } catch { return false; } })();
      const hasSrcDir = existsSync(join(fullPath, 'src')) || existsSync(join(fullPath, 'apps')) || existsSync(join(fullPath, 'source'));
      const hasGit = existsSync(join(fullPath, '.git'));
      const hasConfig = existsSync(join(fullPath, '.env')) || existsSync(join(fullPath, 'config')) || existsSync(join(fullPath, 'docker-compose.yml')) || existsSync(join(fullPath, 'Makefile'));

      if (hasPackage || hasReadme || hasSrcDir || hasGit || hasConfig) {
        const pkg = hasPackage ? this._tryReadPackageJson(fullPath) : null;
        const projectType = pkg?.type || (existsSync(join(fullPath, 'pyproject.toml')) ? 'python' :
                          existsSync(join(fullPath, 'Cargo.toml')) ? 'rust' :
                          existsSync(join(fullPath, 'go.mod')) ? 'go' :
                          existsSync(join(fullPath, 'composer.json')) ? 'php' : 'unknown');
        const proj = upsertProject(db, {
          root_path: fullPath,
          name: entry.name,
          project_type: projectType,
          registry_source: 'discovery',
          file_count: this._countFiles(fullPath),
        });
        projectDirs.push(proj);
        count++;
      }
    }
    this.stats.projectsFound = count;
    console.log(`[UKV] Discovered ${count} projects in ${masterDir}`);
  }

  _indexProject(db, proj) {
    if (!existsSync(proj.root_path)) return;
    // Re-read source map for this project
    clearSourceMap(db, proj.id);
    deleteKnowledgeItemsByProject(db, proj.id);

    let fileCount = 0;
    try {
      const files = fg.sync(['**/*'], {
        cwd: proj.root_path,
        ignore: DEFAULT_EXCLUDES.filter(e => !e.includes('logs')), // exclude logs unless...
        dot: false,
        absolute: false,
        stats: true,
        suppressErrors: true,
        onlyFiles: true,
      });

      for (const f of files.slice(0, 10000)) { // cap per project for scale
        const ext = extname(f.path).toLowerCase();
        const relPath = f.path;
        const fullPath = join(proj.root_path, relPath);
        try {
          upsertSourceMap(db, {
            project_id: proj.id,
            rel_path: relPath,
            file_name: basename(relPath),
            ext: ext || '(none)',
            size_bytes: f.stats?.size || 0,
            mtime_ms: f.stats?.mtimeMs || 0,
          });
          fileCount++;

          // Index content for certain file types (text-based)
          if (this._isIndexableContent(ext)) {
            const content = readFileSync(fullPath, 'utf-8').slice(0, 50000); // max 50KB per file
            const lang = ext === '.md' ? 'markdown' : ext === '.js' ? 'javascript' :
                        ext === '.py' ? 'python' : ext === '.json' ? 'json' :
                        ext === '.ts' ? 'typescript' : 'text';
            upsertKnowledgeItem(db, {
              project_id: proj.id,
              kind: 'source_code',
              subtype: ext.slice(1),
              title: relPath,
              path: relPath,
              source_root: proj.root_path,
              content,
              language: lang,
              size_bytes: content.length,
              mtime_ms: f.stats?.mtimeMs || 0,
              tags: JSON.stringify([proj.name, ext.slice(1), lang]),
            });
          }
        } catch (err) {
          // skip files we can't read
        }
      }
    } catch (err) {
      this.stats.errors.push(`Project ${proj.name}: ${err.message}`);
    }

    db.prepare('UPDATE projects SET file_count = ? WHERE id = ?').run(fileCount, proj.id);
    markProjectIndexed(db, proj.id);
    this.stats.filesIndexed += fileCount;
  }

  _isIndexableContent(ext) {
    const textExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
      '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
      '.sh', '.bash', '.ps1', '.bat', '.cmd', '.env', '.sql', '.css', '.scss', '.less',
      '.html', '.htm', '.vue', '.svelte', '.astro', '.xml', '.svg', '.graphql', '.gql',
      '.tsconfig', '.babelrc', '.eslintrc', '.prettierrc', '.editorconfig',
      '.dockerfile', 'dockerfile', '.gitignore', '.npmrc', '.yarnrc',
      'makefile', 'gnumakefile', '.mjs', '.cjs', '.mts', '.cts'];
    return textExts.includes(ext);
  }

  _indexGlobalMemory(db) {
    const globalDir = resolve(join(this.masterRoot, '..', '.local-agent-global'));
    if (!existsSync(globalDir)) return;
    console.log('[UKV] Indexing .local-agent-global...');
    this._walkAndIndex(db, globalDir, null, 'executive_memory');
  }

  _indexReports(db) {
    const baseDir = join(this.masterRoot, 'Agent', 'agent-coding');
    if (!existsSync(baseDir)) return;
    console.log('[UKV] Indexing reports...');
    const files = readdirSync(baseDir).filter(f => f.endsWith('.md') && !f.startsWith('L') && !f.startsWith('last'));
    for (const f of files) {
      const fullPath = join(baseDir, f);
      try {
        const content = readFileSync(fullPath, 'utf-8').slice(0, 100000);
        const stat = statSync(fullPath);
        const proj = getProject(db, baseDir);
        upsertKnowledgeItem(db, {
          project_id: proj?.id || null,
          kind: 'report',
          title: f.replace('.md', ''),
          path: f,
          source_root: baseDir,
          content,
          size_bytes: content.length,
          mtime_ms: stat.mtimeMs,
          tags: JSON.stringify(['report', 'markdown']),
        });
      } catch {}
    }
  }

  _indexDocs(db) {
    const docsDir = join(this.masterRoot, 'Agent', 'agent-coding', 'docs');
    if (!existsSync(docsDir)) return;
    this._walkAndIndex(db, docsDir, null, 'doc');
  }

  _indexReadmes(db) {
    const projects = listProjects(this.getDB());
    for (const proj of projects) {
      for (const rname of README_FILES) {
        const rpath = join(proj.root_path, rname);
        if (existsSync(rpath)) {
          try {
            const content = readFileSync(rpath, 'utf-8').slice(0, 50000);
            upsertKnowledgeItem(this.getDB(), {
              project_id: proj.id,
              kind: 'readme',
              subtype: 'README',
              title: `${proj.name}/README`,
              path: rname,
              source_root: proj.root_path,
              content,
              size_bytes: content.length,
              tags: JSON.stringify([proj.name, 'readme']),
            });
          } catch {}
        }
      }
    }
  }

  _indexPackageFiles(db) {
    const projects = listProjects(db);
    for (const proj of projects) {
      for (const pf of PACKAGE_FILES) {
        const ppath = join(proj.root_path, pf);
        if (existsSync(ppath)) {
          try {
            const content = readFileSync(ppath, 'utf-8').slice(0, 30000);
            upsertKnowledgeItem(db, {
              project_id: proj.id,
              kind: 'package_json',
              subtype: pf.replace('.', ''),
              title: `${proj.name}/${pf}`,
              path: pf,
              source_root: proj.root_path,
              content,
              size_bytes: content.length,
              tags: JSON.stringify([proj.name, pf, 'package']),
            });
          } catch {}
        }
      }
    }
  }

  _indexSourceMaps(db) {
    // Index existing .local-agent/source-map/ directories
    const projects = listProjects(db);
    for (const proj of projects) {
      const smDir = join(proj.root_path, '.local-agent', 'source-map');
      if (existsSync(smDir)) {
        this._walkAndIndex(db, smDir, proj.id, 'source_map', proj.name);
      }
      // Also index .local-agent itself for this project
      const laDir = join(proj.root_path, '.local-agent');
      if (existsSync(laDir)) {
        this._walkAndIndex(db, laDir, proj.id, 'archive_record', proj.name);
      }
    }
  }

  _indexConnectors(db) {
    const globalDir = resolve(join(this.masterRoot, '..', '.local-agent-global', 'connectors'));
    if (!existsSync(globalDir)) return;
    const dirs = readdirSync(globalDir, { withFileTypes: true });
    for (const d of dirs) {
      if (d.isDirectory()) {
        this._walkAndIndex(db, join(globalDir, d.name), null, 'integration_system_data', d.name);
      }
    }
  }

  _indexWebsites(db) {
    const websitesDir = resolve(join(this.masterRoot, '..', '.local-agent-global', 'websites'));
    if (!existsSync(websitesDir)) return;
    const dirs = readdirSync(websitesDir, { withFileTypes: true });
    for (const d of dirs) {
      if (d.isDirectory()) {
        this._walkAndIndex(db, join(websitesDir, d.name), null, 'website_data', d.name);
      }
    }
  }

  _tryReadPackageJson(dirPath) {
    try {
      const pkgPath = join(dirPath, 'package.json');
      if (existsSync(pkgPath)) {
        const raw = readFileSync(pkgPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { type: parsed.type === 'module' ? 'node-esm' : 'node-cjs', name: parsed.name };
      }
    } catch {}
    return null;
  }

  _countFiles(dirPath) {
    try {
      return fg.sync(['**/*'], { cwd: dirPath, ignore: DEFAULT_EXCLUDES, dot: false, stats: false, suppressErrors: true, onlyFiles: true }).length;
    } catch { return 0; }
  }

  _walkAndIndex(db, dir, projectId = null, kind = 'doc', projectName = null) {
    if (!existsSync(dir)) return;
    try {
      const files = fg.sync(['**/*'], {
        cwd: dir, dot: true, absolute: false, suppressErrors: true, onlyFiles: true,
      });
        for (const f of files) {
          const fullPath = join(dir, f);
          try {
            const stat = statSync(fullPath);
            if (stat.size > 200000) continue; // skip files >200KB
          const content = readFileSync(fullPath, 'utf-8').slice(0, 100000);
          const ext = extname(f).toLowerCase();
          const tags = [kind, ext.slice(1) || 'unknown'];
          if (projectName) tags.push(projectName);
          upsertKnowledgeItem(db, {
            project_id: projectId,
            kind,
            subtype: ext.slice(1) || f,
            title: f,
            path: f,
            source_root: dir,
            content,
            language: ext === '.json' ? 'json' : ext === '.md' ? 'markdown' : 'text',
            size_bytes: stat.size,
            mtime_ms: stat.mtimeMs,
            tags: JSON.stringify(tags),
          });
          this.stats.filesIndexed++;
        } catch {}
      }
    } catch {}
  }

  // SEO / menu / content data indexing
  _indexSEOData() {
    const db = this.getDB();
    // Look for SEO-related files in website directories
    const websitesDir = resolve(join(this.masterRoot, '..', '.local-agent-global', 'websites'));
    if (!existsSync(websitesDir)) return;
    const dirs = readdirSync(websitesDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const siteDir = join(websitesDir, d.name);
      // Find SEO/menu/content files
      const files = fg.sync(['**/*seo*', '**/*menu*', '**/*content*', '**/*sitemap*', '**/*robots*'], {
        cwd: siteDir, dot: true, suppressErrors: true, onlyFiles: true,
      });
      for (const f of files) {
        const fullPath = join(siteDir, f);
        try {
          const stat = statSync(fullPath);
          const content = readFileSync(fullPath, 'utf-8').slice(0, 50000);
          const kind = f.toLowerCase().includes('seo') ? 'seo_data' :
                      f.toLowerCase().includes('menu') ? 'menu_data' : 'content_data';
          upsertKnowledgeItem(db, {
            project_id: null,
            kind,
            title: `${d.name}/${f}`,
            path: f,
            source_root: siteDir,
            content,
            size_bytes: stat.size,
            mtime_ms: stat.mtimeMs,
            tags: JSON.stringify([d.name, kind, 'website']),
          });
        } catch {}
      }
    }
  }
}
