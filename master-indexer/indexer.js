#!/usr/bin/env node
/**
 * Master Source Indexer
 * Scans E:\Project\Master and builds structured metadata
 * 
 * Usage:
 *   node indexer.js --full          Full index of all projects
 *   node indexer.js --incremental   Incremental update
 *   node indexer.js --project <name> Index single project
 *   node indexer.js --export json   Export as JSON
 *   node indexer.js --export md     Export as Markdown
 *   node indexer.js --health        Health check
 */

const path = require('path');
const fs = require('fs');
const { Scanner } = require('./scanner');
const { GitAnalyzer } = require('./git-analyzer');
const { DepParser } = require('./dep-parser');
const { DBManager } = require('./db-manager');
const { OutputGenerator } = require('./output-generator');

const ROOT = 'E:\\Project\\Master';

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--full';
  
  console.log('🔍 Master Source Indexer');
  console.log('========================\n');
  console.log(`Root: ${ROOT}`);
  console.log(`Mode: ${mode}\n`);
  
  const db = new DBManager(path.join(__dirname, 'data', 'master-index.db'));
  await db.initialize();
  
  const scanner = new Scanner(ROOT);
  const gitAnalyzer = new GitAnalyzer();
  const depParser = new DepParser();
  const outputGen = new OutputGenerator(db, path.join(__dirname, 'output'));
  
  const startTime = Date.now();
  
  try {
    switch (mode) {
      case '--full':
        console.log('📦 Running full index...\n');
        await runFullIndex(db, scanner, gitAnalyzer, depParser);
        await outputGen.generateAll();
        break;
        
      case '--incremental':
        console.log('🔄 Running incremental update...\n');
        await runIncremental(db, scanner, gitAnalyzer, depParser);
        await outputGen.generateAll();
        break;
        
      case '--project':
        const projectName = args[1];
        if (!projectName) {
          console.error('❌ Please specify project name: --project <name>');
          process.exit(1);
        }
        console.log(`📦 Indexing project: ${projectName}\n`);
        await indexProject(db, scanner, gitAnalyzer, depParser, projectName);
        await outputGen.generateAll();
        break;
        
      case '--export':
        const format = args[1] || 'json';
        console.log(`📤 Exporting as ${format.toUpperCase()}...\n`);
        if (format === 'json') {
          await outputGen.exportJSON();
        } else if (format === 'md') {
          await outputGen.exportMarkdown();
        }
        break;
        
      case '--health':
        console.log('🏥 Health check...\n');
        await checkHealth(db);
        break;
        
      default:
        console.log(`Unknown mode: ${mode}`);
        console.log('Usage:');
        console.log('  --full          Full index of all projects');
        console.log('  --incremental   Incremental update');
        console.log('  --project <name> Index single project');
        console.log('  --export json   Export as JSON');
        console.log('  --export md     Export as Markdown');
        console.log('  --health        Health check');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Done in ${duration}s`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.close();
  }
}

async function runFullIndex(db, scanner, gitAnalyzer, depParser) {
  const projects = await scanner.discoverProjects();
  console.log(`Found ${projects.length} projects\n`);
  
  let indexed = 0;
  let errors = 0;
  
  for (const project of projects) {
    try {
      await indexProjectData(db, scanner, gitAnalyzer, depParser, project);
      indexed++;
      console.log(`  ✅ ${project.name}`);
    } catch (err) {
      errors++;
      console.log(`  ❌ ${project.name}: ${err.message}`);
    }
  }
  
  console.log(`\n📊 Indexed: ${indexed}, Errors: ${errors}`);
}

async function runIncremental(db, scanner, gitAnalyzer, depParser) {
  const lastIndex = await db.getLastIndexTime();
  const projects = await scanner.discoverProjects();
  
  let updated = 0;
  
  for (const project of projects) {
    const mtime = fs.statSync(project.path).mtime;
    if (mtime > lastIndex) {
      await indexProjectData(db, scanner, gitAnalyzer, depParser, project);
      updated++;
    }
  }
  
  console.log(`Updated ${updated} projects since last index`);
}

async function indexProject(db, scanner, gitAnalyzer, depParser, projectName) {
  const projects = await scanner.discoverProjects();
  const project = projects.find(p => 
    p.name.toLowerCase() === projectName.toLowerCase()
  );
  
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }
  
  await indexProjectData(db, scanner, gitAnalyzer, depParser, project);
}

async function indexProjectData(db, scanner, gitAnalyzer, depParser, project) {
  // Scan project files
  const scanResult = await scanner.scanProject(project.path);
  
  // Get Git info
  const gitInfo = gitAnalyzer.analyze(project.path);
  
  // Parse dependencies
  const deps = await depParser.parse(project.path);
  
  // Calculate size metrics
  const metrics = scanner.calculateMetrics(scanResult);
  
  // Store in database
  db.upsertProject({
    project_name: project.name,
    display_name: project.displayName,
    path: project.path,
    git_remote: gitInfo.remote,
    git_branch: gitInfo.branch,
    git_status: gitInfo.status,
    language_main: metrics.primaryLanguage,
    language_secondary: metrics.secondaryLanguage,
    framework: deps.framework,
    total_files: metrics.fileCount,
    total_lines: metrics.totalLines,
    dir_count: metrics.dirCount,
    size_bytes: metrics.sizeBytes,
    last_indexed: new Date().toISOString(),
    last_modified: metrics.lastModified
  });
  
  // Store dependencies
  for (const dep of deps.dependencies) {
    db.addDependency({
      project_name: project.name,
      dep_type: dep.type,
      dep_name: dep.name,
      dep_version: dep.version,
      is_dev: dep.isDev
    });
  }
  
  // Store modules (top-level directories)
  const modules = scanner.identifyModules(project.path, scanResult.files);
  for (const mod of modules) {
    db.upsertModule({
      project_name: project.name,
      module_name: mod.name,
      path: mod.path,
      language: mod.language,
      file_count: mod.fileCount
    });
  }
}

async function checkHealth(db) {
  const stats = await db.getStats();
  
  console.log('📊 Database Health');
  console.log('==================');
  console.log(`Projects: ${stats.projectCount}`);
  console.log(`Modules: ${stats.moduleCount}`);
  console.log(`Files tracked: ${stats.fileCount}`);
  console.log(`Dependencies: ${stats.depCount}`);
  console.log(`Last index: ${stats.lastIndex || 'Never'}`);
  
  const stale = await db.getStaleProjects();
  if (stale.length > 0) {
    console.log(`\n⚠️  Stale projects (not indexed in 30+ days):`);
    for (const p of stale) {
      console.log(`  - ${p.project_name} (${p.last_indexed})`);
    }
  }
  
  const critical = await db.getCriticalProjects();
  if (critical.length > 0) {
    console.log(`\n🔴 Critical projects (P0/P1):`);
    for (const p of critical) {
      console.log(`  - ${p.project_name} (${p.criticality})`);
    }
  }
}

main();
