/**
 * File System Scanner
 * Discovers projects and scans file structures
 */

const fs = require('fs');
const path = require('path');

const INCLUDE_EXTENSIONS = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.cs': 'CSharp',
  '.go': 'Go',
  '.rs': 'Rust',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.ps1': 'PowerShell',
  '.bat': 'Batch',
  '.html': 'HTML',
  '.css': 'CSS'
};

const EXCLUDE_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.nyc_output', '.pytest_cache', '__pycache__', 'venv', '.venv',
  'bin', 'obj', 'target', '.idea', '.vscode'
];

const EXCLUDE_EXTENSIONS = [
  '.log', '.tmp', '.temp', '.zip', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib'
];

class Scanner {
  constructor(rootPath) {
    this.rootPath = rootPath;
  }
  
  /**
   * Discover all projects under the root path
   */
  discoverProjects() {
    const entries = fs.readdirSync(this.rootPath, { withFileTypes: true });
    const projects = [];
    
    for (const entry of entries) {
      // Skip hidden directories and excluded
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      
      const fullPath = path.join(this.rootPath, entry.name);
      
      if (entry.isDirectory()) {
        // Check if it's a git repository (has .git folder)
        const isGitRepo = fs.existsSync(path.join(fullPath, '.git'));
        
        // Check if it has a package.json or other project markers
        const hasPackageJson = fs.existsSync(path.join(fullPath, 'package.json'));
        const hasPyproject = fs.existsSync(path.join(fullPath, 'pyproject.toml'));
        const hasGoMod = fs.existsSync(path.join(fullPath, 'go.mod'));
        const hasCargoToml = fs.existsSync(path.join(fullPath, 'Cargo.toml'));
        const hasCsproj = fs.existsSync(path.join(fullPath, '*.csproj'));
        
        if (isGitRepo || hasPackageJson || hasPyproject || hasGoMod || hasCargoToml || hasCsproj) {
          projects.push({
            name: this.normalizeName(entry.name),
            displayName: this.formatName(entry.name),
            path: fullPath,
            isGitRepo
          });
        } else {
          // Check subdirectories for projects
          const subProjects = this.findProjectsInSubdir(fullPath, entry.name);
          projects.push(...subProjects);
        }
      } else if (entry.isFile()) {
        // Check for project config files in root
        if (entry.name === 'package.json' || entry.name === 'pyproject.toml' || 
            entry.name === 'go.mod' || entry.name === 'Cargo.toml') {
          projects.push({
            name: this.normalizeName(path.basename(this.rootPath)),
            displayName: this.formatName(path.basename(this.rootPath)),
            path: this.rootPath,
            isGitRepo: fs.existsSync(path.join(this.rootPath, '.git'))
          });
        }
      }
    }
    
    return projects;
  }
  
  /**
   * Find projects in subdirectories (for folders like Agent/, Bakudan/)
   */
  findProjectsInSubdir(dirPath, parentName) {
    const projects = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const hasGit = fs.existsSync(path.join(fullPath, '.git'));
        const hasPackageJson = fs.existsSync(path.join(fullPath, 'package.json'));
        const hasPyproject = fs.existsSync(path.join(fullPath, 'pyproject.toml'));
        
        if (hasGit || hasPackageJson || hasPyproject) {
          const projectName = `${parentName}/${entry.name}`;
          projects.push({
            name: this.normalizeName(projectName),
            displayName: this.formatName(projectName),
            path: fullPath,
            isGitRepo: hasGit
          });
        } else {
          // Recurse deeper
          const subProjects = this.findProjectsInSubdir(fullPath, `${parentName}/${entry.name}`);
          projects.push(...subProjects);
        }
      }
    }
    
    return projects;
  }
  
  /**
   * Scan all files in a project
   */
  async scanProject(projectPath) {
    const files = [];
    const stats = {
      byExtension: {},
      totalLines: 0,
      totalSize: 0
    };
    
    this.walkDir(projectPath, (filePath, stat) => {
      const ext = path.extname(filePath).toLowerCase();
      const name = path.basename(filePath);
      
      // Skip excluded
      if (EXCLUDE_EXTENSIONS.includes(ext)) return;
      
      const language = INCLUDE_EXTENSIONS[ext] || 'Other';
      
      // Count lines for text files
      let lineCount = 0;
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go', '.rs', '.sh', '.ps1', '.md', '.sql'].includes(ext)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          lineCount = content.split('\n').length;
        } catch (e) {
          // Binary or unreadable file
        }
      }
      
      files.push({
        path: filePath,
        relativePath: path.relative(projectPath, filePath),
        name,
        extension: ext,
        language,
        lineCount,
        size: stat.size,
        isTest: this.isTestFile(filePath),
        isConfig: this.isConfigFile(name),
        modified: stat.mtime
      });
      
      // Update stats
      stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;
      stats.totalLines += lineCount;
      stats.totalSize += stat.size;
    });
    
    return { files, stats };
  }
  
  /**
   * Walk directory and invoke callback for each file
   */
  walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip excluded directories
        if (entry.isDirectory()) {
          if (EXCLUDE_DIRS.includes(entry.name)) continue;
          this.walkDir(fullPath, callback);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          callback(fullPath, stat);
        }
      }
    } catch (e) {
      // Permission error or other
      console.warn(`Warning: Cannot access ${dir}: ${e.message}`);
    }
  }
  
  /**
   * Calculate size metrics from files
   */
  calculateMetrics(scanResult) {
    const { files, stats } = scanResult;
    
    // Find primary and secondary languages
    const langCounts = {};
    for (const file of files) {
      if (file.language !== 'Other' && file.language !== 'JSON' && file.language !== 'Markdown') {
        langCounts[file.language] = (langCounts[file.language] || 0) + file.lineCount;
      }
    }
    
    const sortedLangs = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);
    
    // Count directories
    const dirs = new Set();
    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join(path.sep));
      }
    }
    
    // Find last modified
    let lastModified = null;
    for (const file of files) {
      if (!lastModified || file.modified > lastModified) {
        lastModified = file.modified;
      }
    }
    
    return {
      fileCount: files.length,
      totalLines: stats.totalLines,
      sizeBytes: stats.totalSize,
      dirCount: dirs.size,
      primaryLanguage: sortedLangs[0] || 'Unknown',
      secondaryLanguage: sortedLangs[1] || null,
      languageBreakdown: langCounts,
      lastModified: lastModified ? lastModified.toISOString() : null
    };
  }
  
  /**
   * Identify top-level modules (directories with source files)
   */
  identifyModules(projectPath, files) {
    const modules = new Map();
    
    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      if (parts.length > 1) {
        const moduleName = parts[0];
        if (!modules.has(moduleName)) {
          modules.set(moduleName, {
            name: moduleName,
            path: path.join(projectPath, moduleName),
            fileCount: 0,
            languages: new Set()
          });
        }
        
        const mod = modules.get(moduleName);
        mod.fileCount++;
        mod.languages.add(file.language);
      }
    }
    
    return Array.from(modules.values()).map(m => ({
      name: m.name,
      path: m.path,
      fileCount: m.fileCount,
      language: Array.from(m.languages).join(', ')
    }));
  }
  
  /**
   * Normalize project name for database
   */
  normalizeName(name) {
    return name.toLowerCase().replace(/[^a-z0-9\/\-_]/g, '-').replace(/\/+/g, '-');
  }
  
  /**
   * Format project name for display
   */
  formatName(name) {
    return name.split(/[\/\-_]/).map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' / ');
  }
  
  /**
   * Check if file is a test file
   */
  isTestFile(filePath) {
    const name = path.basename(filePath).toLowerCase();
    return name.includes('.test.') || name.includes('.spec.') ||
           name.startsWith('test-') || name.endsWith('-test.') ||
           name.startsWith('__tests__') || name.startsWith('tests\\');
  }
  
  /**
   * Check if file is a config file
   */
  isConfigFile(name) {
    const configNames = [
      'package.json', 'package-lock.json', 'tsconfig.json', 'jsconfig.json',
      'pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile',
      'go.mod', 'go.sum', 'Cargo.toml',
      '.gitignore', '.env', '.env.example',
      'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
      'webpack.config.js', 'vite.config.js', 'rollup.config.js',
      'jest.config.js', 'vitest.config.ts', 'pytest.ini',
      '.eslintrc', '.eslintrc.json', '.prettierrc'
    ];
    return configNames.includes(name);
  }
}

module.exports = { Scanner };
