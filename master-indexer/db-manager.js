/**
 * Database Manager
 * SQLite operations for Master Index using sql.js (pure JS, no native deps)
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

class DBManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.SQL = null;
  }
  
  async initialize() {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.SQL = await initSqlJs();
    
    // Load existing database or create new
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }
    
    // Create tables
    this.createTables();
    this.save();
  }
  
  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }
  
  createTables() {
    // Projects table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL UNIQUE,
        display_name TEXT,
        path TEXT NOT NULL,
        git_remote TEXT,
        git_branch TEXT,
        git_status TEXT DEFAULT 'unknown',
        language_main TEXT,
        language_secondary TEXT,
        framework TEXT,
        owner TEXT,
        criticality TEXT DEFAULT 'P2',
        status TEXT DEFAULT 'active',
        total_files INTEGER DEFAULT 0,
        total_lines INTEGER DEFAULT 0,
        dir_count INTEGER DEFAULT 0,
        size_bytes INTEGER DEFAULT 0,
        last_indexed TEXT,
        last_modified TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    // Modules table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        module_name TEXT NOT NULL,
        path TEXT NOT NULL,
        language TEXT,
        framework TEXT,
        file_count INTEGER DEFAULT 0,
        line_count INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);
    
    // Dependencies table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS dependencies (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        dep_type TEXT NOT NULL,
        dep_name TEXT NOT NULL,
        dep_version TEXT,
        is_dev INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);
    
    // Create indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_projects_criticality ON projects(criticality)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_modules_project ON modules(project_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_deps_project ON dependencies(project_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_deps_name ON dependencies(dep_name)`);
  }
  
  // Helper to run a query and return all rows
  queryAll(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
  
  // Helper to get a single row
  queryOne(sql, params = []) {
    const results = this.queryAll(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  // Project operations
  upsertProject(data) {
    const id = randomUUID();
    
    // Check if project exists
    const existing = this.queryOne('SELECT id FROM projects WHERE project_name = ?', [data.project_name]);
    
    if (existing) {
      this.db.run(`
        UPDATE projects SET
          display_name = ?, path = ?, git_remote = ?, git_branch = ?,
          git_status = ?, language_main = ?, language_secondary = ?,
          framework = ?, total_files = ?, total_lines = ?,
          dir_count = ?, size_bytes = ?, last_indexed = ?, last_modified = ?
        WHERE project_name = ?
      `, [
        data.display_name, data.path, data.git_remote, data.git_branch,
        data.git_status || 'unknown', data.language_main, data.language_secondary,
        data.framework, data.total_files || 0, data.total_lines || 0,
        data.dir_count || 0, data.size_bytes || 0, data.last_indexed, data.last_modified,
        data.project_name
      ]);
      
      // Clear old dependencies for re-indexing
      this.db.run('DELETE FROM dependencies WHERE project_id = ?', [existing.id]);
      
      this.save();
      return existing.id;
    } else {
      this.db.run(`
        INSERT INTO projects (
          id, project_name, display_name, path, git_remote, git_branch,
          git_status, language_main, language_secondary, framework,
          owner, criticality, status, total_files, total_lines,
          dir_count, size_bytes, last_indexed, last_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, data.project_name, data.display_name, data.path,
        data.git_remote, data.git_branch, data.git_status || 'unknown',
        data.language_main, data.language_secondary, data.framework,
        data.owner || null, data.criticality || 'P2', data.status || 'active',
        data.total_files || 0, data.total_lines || 0,
        data.dir_count || 0, data.size_bytes || 0,
        data.last_indexed, data.last_modified
      ]);
      
      this.save();
      return id;
    }
  }
  
  getProject(projectName) {
    return this.queryOne('SELECT * FROM projects WHERE project_name = ?', [projectName]);
  }
  
  getAllProjects() {
    return this.queryAll('SELECT * FROM projects ORDER BY project_name');
  }
  
  getCriticalProjects() {
    return this.queryAll("SELECT * FROM projects WHERE criticality IN ('P0', 'P1') ORDER BY criticality, project_name");
  }
  
  getStaleProjects() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return this.queryAll(`
      SELECT * FROM projects 
      WHERE last_indexed < ? OR last_indexed IS NULL
      ORDER BY last_indexed
    `, [thirtyDaysAgo.toISOString()]);
  }
  
  // Module operations
  upsertModule(data) {
    const project = this.getProject(data.project_name);
    if (!project) return null;
    
    const id = randomUUID();
    
    // Check if module exists
    const existing = this.queryOne(
      'SELECT id FROM modules WHERE project_id = ? AND module_name = ?',
      [project.id, data.module_name]
    );
    
    if (existing) {
      this.db.run(`
        UPDATE modules SET path = ?, language = ?, file_count = ?
        WHERE id = ?
      `, [data.path, data.language, data.file_count || 0, existing.id]);
    } else {
      this.db.run(`
        INSERT INTO modules (id, project_id, module_name, path, language, file_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, project.id, data.module_name, data.path, data.language, data.file_count || 0]);
    }
    
    this.save();
    return existing ? existing.id : id;
  }
  
  getModulesByProject(projectName) {
    const project = this.getProject(projectName);
    if (!project) return [];
    
    return this.queryAll('SELECT * FROM modules WHERE project_id = ?', [project.id]);
  }
  
  // Dependency operations
  addDependency(data) {
    const project = this.getProject(data.project_name);
    if (!project) return null;
    
    const id = randomUUID();
    
    this.db.run(`
      INSERT INTO dependencies (id, project_id, dep_type, dep_name, dep_version, is_dev)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, project.id, data.dep_type, data.dep_name, data.dep_version, data.is_dev ? 1 : 0]);
    
    this.save();
    return id;
  }
  
  getDependenciesByProject(projectName) {
    const project = this.getProject(projectName);
    if (!project) return [];
    
    return this.queryAll('SELECT * FROM dependencies WHERE project_id = ?', [project.id]);
  }
  
  getDependencyMap() {
    return this.queryAll(`
      SELECT p.project_name, d.dep_type, d.dep_name, d.dep_version, d.is_dev
      FROM projects p
      JOIN dependencies d ON p.id = d.project_id
      ORDER BY p.project_name, d.dep_type, d.dep_name
    `);
  }
  
  // Stats
  getStats() {
    const projectCount = this.queryOne('SELECT COUNT(*) as count FROM projects').count;
    const moduleCount = this.queryOne('SELECT COUNT(*) as count FROM modules').count;
    const fileCount = this.queryOne('SELECT COALESCE(SUM(total_files), 0) as total FROM projects').total;
    const depCount = this.queryOne('SELECT COUNT(*) as count FROM dependencies').count;
    const lastIndex = this.queryOne('SELECT MAX(last_indexed) as last FROM projects').last;
    
    return {
      projectCount,
      moduleCount,
      fileCount,
      depCount,
      lastIndex
    };
  }
  
  getLastIndexTime() {
    const row = this.queryOne('SELECT MAX(last_indexed) as last FROM projects');
    return row && row.last ? new Date(row.last) : new Date(0);
  }
  
  // Query helpers
  findProjectsByLanguage(language) {
    return this.queryAll(`
      SELECT * FROM projects 
      WHERE language_main = ? OR language_secondary = ?
      ORDER BY project_name
    `, [language, language]);
  }
  
  findProjectsByFramework(framework) {
    return this.queryAll(`
      SELECT * FROM projects 
      WHERE framework LIKE ?
      ORDER BY project_name
    `, [`%${framework}%`]);
  }
  
  findProjectsByStatus(status) {
    return this.queryAll('SELECT * FROM projects WHERE status = ? ORDER BY project_name', [status]);
  }
  
  // Cleanup
  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = { DBManager };
