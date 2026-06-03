/**
 * Dependency Parser
 * Extracts dependencies from various package managers
 */

const fs = require('fs');
const path = require('path');

class DepParser {
  constructor() {
    this.parsers = {
      'package.json': this.parseNpm.bind(this),
      'package-lock.json': this.parseNpmLock.bind(this),
      'pyproject.toml': this.parsePyproject.bind(this),
      'requirements.txt': this.parseRequirements.bind(this),
      'go.mod': this.parseGoMod.bind(this),
      'Cargo.toml': this.parseCargo.bind(this),
      'composer.json': this.parseComposer.bind(this)
    };
  }
  
  /**
   * Parse all dependencies in a project
   */
  async parse(projectPath) {
    const results = {
      dependencies: [],
      framework: null
    };
    
    // Try each parser
    for (const [file, parser] of Object.entries(this.parsers)) {
      const filePath = path.join(projectPath, file);
      
      if (fs.existsSync(filePath)) {
        try {
          const parsed = await parser(filePath);
          results.dependencies.push(...parsed.dependencies);
          if (parsed.framework) {
            results.framework = parsed.framework;
          }
        } catch (error) {
          console.warn(`Error parsing ${file}: ${error.message}`);
        }
      }
    }
    
    // Deduplicate
    const seen = new Set();
    results.dependencies = results.dependencies.filter(dep => {
      const key = `${dep.type}:${dep.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return results;
  }
  
  /**
   * Parse package.json (npm/Node.js)
   */
  parseNpm(filePath) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const deps = [];
    
    // Detect framework
    const pkg = content.name || '';
    const deps_keys = Object.keys(content.dependencies || {});
    
    if (deps_keys.includes('next') || deps_keys.includes('react')) {
      content.framework = 'React/Next.js';
    } else if (deps_keys.includes('@angular/core')) {
      content.framework = 'Angular';
    } else if (deps_keys.includes('@nestjs/core')) {
      content.framework = 'NestJS';
    } else if (deps_keys.includes('express')) {
      content.framework = 'Express';
    } else if (deps_keys.includes('fastify')) {
      content.framework = 'Fastify';
    } else if (deps_keys.includes('vue')) {
      content.framework = 'Vue';
    } else if (deps_keys.includes('@sveltejs/kit')) {
      content.framework = 'SvelteKit';
    }
    
    // Production dependencies
    for (const [name, version] of Object.entries(content.dependencies || {})) {
      deps.push({
        type: 'npm',
        name,
        version,
        isDev: false
      });
    }
    
    // Development dependencies
    for (const [name, version] of Object.entries(content.devDependencies || {})) {
      deps.push({
        type: 'npm',
        name,
        version,
        isDev: true
      });
    }
    
    return { dependencies: deps, framework: content.framework };
  }
  
  /**
   * Parse package-lock.json (npm lockfile - more accurate versions)
   */
  parseNpmLock(filePath) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const deps = [];
    
    // Parse packages from lockfile v2/3
    const packages = content.packages || {};
    
    for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
      if (pkgPath === '') continue; // Skip root package
      
      const name = pkgInfo.name || pkgPath.split('node_modules/').pop();
      const version = pkgInfo.version;
      
      if (name && version) {
        deps.push({
          type: 'npm',
          name,
          version,
          isDev: pkgPath.includes('node_modules/') && !pkgPath.includes('/node_modules/', 1)
        });
      }
    }
    
    return { dependencies: deps, framework: null };
  }
  
  /**
   * Parse pyproject.toml (Python)
   */
  parsePyproject(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const deps = [];
    
    // Simple TOML parsing (basic regex approach)
    // Look for dependencies = [...]
    const depMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depMatch) {
      const depStr = depMatch[1];
      // Match quoted strings
      const matches = depStr.matchAll(/"([^"]+)"|'([^']+)'/g);
      for (const match of matches) {
        const dep = match[1] || match[2];
        const [name, version] = dep.replace(/["']/g, '').split(/[=<>!]/);
        deps.push({
          type: 'pip',
          name: name.trim(),
          version: version ? version.trim() : '*',
          isDev: false
        });
      }
    }
    
    // Detect framework
    if (content.includes('"fastapi"') || content.includes("'fastapi'")) {
      return { dependencies: deps, framework: 'FastAPI' };
    } else if (content.includes('"django"') || content.includes("'django'")) {
      return { dependencies: deps, framework: 'Django' };
    } else if (content.includes('"flask"') || content.includes("'flask'")) {
      return { dependencies: deps, framework: 'Flask' };
    } else if (content.includes('"pytest"') || content.includes("'pytest'")) {
      return { dependencies: deps, framework: 'pytest' };
    }
    
    return { dependencies: deps, framework: null };
  }
  
  /**
   * Parse requirements.txt (Python)
   */
  parseRequirements(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const deps = [];
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
        continue;
      }
      
      // Parse package==version or package>=version etc.
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[=<>!~]+(.+))?/);
      if (match) {
        deps.push({
          type: 'pip',
          name: match[1],
          version: match[2] || '*',
          isDev: false
        });
      }
    }
    
    return { dependencies: deps, framework: null };
  }
  
  /**
   * Parse go.mod (Go)
   */
  parseGoMod(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const deps = [];
    
    let inRequire = false;
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      
      if (trimmed === 'require (') {
        inRequire = true;
        continue;
      }
      
      if (inRequire && trimmed === ')') {
        inRequire = false;
        continue;
      }
      
      if (inRequire || (!inRequire && trimmed && !trimmed.startsWith('module') && !trimmed.startsWith('go '))) {
        // Single line require
        if (!inRequire && trimmed.includes(' ')) {
          const [name, version] = trimmed.split(' ').filter(Boolean);
          if (name && !name.startsWith('//')) {
            deps.push({
              type: 'go',
              name,
              version: version || '*',
              isDev: false
            });
          }
        } else if (inRequire && trimmed) {
          const [name, version] = trimmed.split(' ').filter(Boolean);
          if (name) {
            deps.push({
              type: 'go',
              name,
              version: version || '*',
              isDev: false
            });
          }
        }
      }
    }
    
    return { dependencies: deps, framework: 'Go' };
  }
  
  /**
   * Parse Cargo.toml (Rust)
   */
  parseCargo(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const deps = [];
    
    let inDependencies = false;
    let inDevDependencies = false;
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      
      if (trimmed === '[dependencies]') {
        inDependencies = true;
        inDevDependencies = false;
        continue;
      }
      
      if (trimmed === '[dev-dependencies]') {
        inDependencies = false;
        inDevDependencies = true;
        continue;
      }
      
      if (trimmed.startsWith('[')) {
        inDependencies = false;
        inDevDependencies = false;
        continue;
      }
      
      if ((inDependencies || inDevDependencies) && trimmed && !trimmed.startsWith('#')) {
        // Parse dependency
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:\s*=\s*)?({?\s*"([^"]+)"?.*}?)?/);
        if (match) {
          deps.push({
            type: 'cargo',
            name: match[1],
            version: match[3] || '*',
            isDev: inDevDependencies
          });
        }
      }
    }
    
    return { dependencies: deps, framework: 'Rust' };
  }
  
  /**
   * Parse composer.json (PHP)
   */
  parseComposer(filePath) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const deps = [];
    
    for (const [name, version] of Object.entries(content.require || {})) {
      if (name !== 'php' && !name.startsWith('ext-')) {
        deps.push({
          type: 'composer',
          name,
          version: typeof version === 'string' ? version : '*',
          isDev: false
        });
      }
    }
    
    for (const [name, version] of Object.entries(content['require-dev'] || {})) {
      deps.push({
        type: 'composer',
        name,
        version: typeof version === 'string' ? version : '*',
        isDev: true
      });
    }
    
    return { dependencies: deps, framework: 'PHP' };
  }
}

module.exports = { DepParser };
