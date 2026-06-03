/**
 * Output Generator
 * Generates JSON and Markdown outputs from the index database
 */

const fs = require('fs');
const path = require('path');

class OutputGenerator {
  constructor(db, outputDir) {
    this.db = db;
    this.outputDir = outputDir;
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
  
  /**
   * Generate all outputs
   */
  async generateAll() {
    await this.exportJSON();
    await this.exportMarkdown();
  }
  
  /**
   * Export MASTER_INDEX.json
   */
  async exportJSON() {
    const projects = this.db.getAllProjects();
    
    const index = {
      generated_at: new Date().toISOString(),
      total_projects: projects.length,
      total_files: projects.reduce((sum, p) => sum + (p.total_files || 0), 0),
      total_lines: projects.reduce((sum, p) => sum + (p.total_lines || 0), 0),
      index_version: '1.0',
      projects: projects.map(p => ({
        project_name: p.project_name,
        display_name: p.display_name,
        path: p.path,
        git_remote: p.git_remote,
        git_branch: p.git_branch,
        git_status: p.git_status,
        language_main: p.language_main,
        language_secondary: p.language_secondary,
        framework: p.framework,
        owner: p.owner,
        criticality: p.criticality,
        status: p.status,
        total_files: p.total_files,
        total_lines: p.total_lines,
        size_bytes: p.size_bytes,
        dependencies: this.getDependenciesForProject(p.project_name),
        modules: this.getModulesForProject(p.project_name),
        last_indexed: p.last_indexed,
        last_modified: p.last_modified
      }))
    };
    
    const outputPath = path.join(this.outputDir, 'MASTER_INDEX.json');
    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf8');
    console.log(`✅ Generated: ${outputPath}`);
    
    return index;
  }
  
  /**
   * Export MASTER_PROJECTS.md
   */
  async exportMarkdown() {
    const projects = this.db.getAllProjects();
    
    let md = `# MASTER PROJECTS\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    md += `**Total Projects:** ${projects.length}\n\n`;
    
    // Group by status
    const active = projects.filter(p => p.status === 'active');
    const maintenance = projects.filter(p => p.status === 'maintenance');
    const archived = projects.filter(p => p.status === 'archive');
    
    // Active projects table
    md += `## Active Projects (${active.length})\n\n`;
    md += `| Project | Language | Framework | Criticality | Files | Git |\n`;
    md += `|---------|----------|----------|------------|-------|-----|\n`;
    
    for (const p of active) {
      md += `| ${p.display_name || p.project_name} `;
      md += `| ${p.language_main || '-'} `;
      md += `| ${p.framework || '-'} `;
      md += `| ${this.renderCriticality(p.criticality)} `;
      md += `| ${p.total_files || 0} `;
      md += `| ${this.renderGitStatus(p)} |\n`;
    }
    
    if (maintenance.length > 0) {
      md += `\n## Maintenance (${maintenance.length})\n\n`;
      md += `| Project | Language | Criticality | Status |\n`;
      md += `|---------|----------|------------|--------|\n`;
      
      for (const p of maintenance) {
        md += `| ${p.display_name || p.project_name} `;
        md += `| ${p.language_main || '-'} `;
        md += `| ${p.criticality || '-'} `;
        md += `| ${p.status} |\n`;
      }
    }
    
    if (archived.length > 0) {
      md += `\n## Archived (${archived.length})\n\n`;
      md += `| Project | Last Modified |\n`;
      md += `|---------|---------------|\n`;
      
      for (const p of archived) {
        md += `| ${p.display_name || p.project_name} `;
        md += `| ${p.last_modified || '-'} |\n`;
      }
    }
    
    // Dependencies summary
    const depMap = this.db.getDependencyMap();
    const internalDeps = new Set();
    const externalDeps = {};
    
    for (const dep of depMap) {
      if (dep.dep_type === 'internal') {
        internalDeps.add(dep.dep_name);
      } else {
        if (!externalDeps[dep.dep_type]) {
          externalDeps[dep.dep_type] = new Set();
        }
        externalDeps[dep.dep_type].add(dep.dep_name);
      }
    }
    
    md += `\n## Dependencies Summary\n\n`;
    md += `**Internal Dependencies:** ${internalDeps.size}\n\n`;
    for (const dep of internalDeps) {
      md += `- ${dep}\n`;
    }
    
    md += `\n`;
    for (const [type, deps] of Object.entries(externalDeps)) {
      md += `**${type.toUpperCase()} Dependencies:** ${deps.size}\n\n`;
      const depList = Array.from(deps).slice(0, 20);
      for (const dep of depList) {
        md += `- ${dep}\n`;
      }
      if (deps.size > 20) {
        md += `- ... and ${deps.size - 20} more\n`;
      }
      md += `\n`;
    }
    
    // Critical projects
    const critical = this.db.getCriticalProjects();
    if (critical.length > 0) {
      md += `## Critical Projects (P0/P1)\n\n`;
      md += `| Project | Criticality | Health | Owner |\n`;
      md += `|---------|-------------|--------|-------|\n`;
      
      for (const p of critical) {
        md += `| ${p.display_name || p.project_name} `;
        md += `| ${p.criticality} `;
        md += `| ${this.renderHealth(p)} `;
        md += `| ${p.owner || '-'} |\n`;
      }
    }
    
    const outputPath = path.join(this.outputDir, 'MASTER_PROJECTS.md');
    fs.writeFileSync(outputPath, md, 'utf8');
    console.log(`✅ Generated: ${outputPath}`);
    
    // Also generate MASTER_DEPENDENCIES.md
    await this.exportDependencies();
    
    return md;
  }
  
  /**
   * Export MASTER_DEPENDENCIES.md
   */
  async exportDependencies() {
    const depMap = this.db.getDependencyMap();
    const projects = this.db.getAllProjects();
    
    let md = `# MASTER DEPENDENCIES\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    
    // Group dependencies by type
    const byType = {};
    for (const dep of depMap) {
      if (!byType[dep.dep_type]) {
        byType[dep.dep_type] = [];
      }
      byType[dep.dep_type].push(dep);
    }
    
    for (const [type, deps] of Object.entries(byType)) {
      md += `## ${type.toUpperCase()} Dependencies (${deps.length})\n\n`;
      md += `| Project | Dependency | Version | Dev |\n`;
      md += `|---------|------------|---------|-----|\n`;
      
      for (const dep of deps.sort((a, b) => a.project_name.localeCompare(b.project_name))) {
        md += `| ${dep.project_name} `;
        md += `| ${dep.dep_name} `;
        md += `| ${dep.dep_version || '*'} `;
        md += `| ${dep.is_dev ? 'Yes' : '-'} |\n`;
      }
      md += `\n`;
    }
    
    // Dependency graph (who depends on what)
    md += `## Dependency Graph\n\n`;
    md += `### Projects by Dependencies\n\n`;
    
    for (const project of projects.sort((a, b) => a.project_name.localeCompare(b.project_name))) {
      const deps = depsForProject(depMap, project.project_name);
      if (deps.length > 0) {
        md += `### ${project.display_name || project.project_name}\n\n`;
        md += `Depends on:\n`;
        for (const dep of deps) {
          md += `- ${dep.dep_name} (${dep.dep_type})\n`;
        }
        md += `\n`;
      }
    }
    
    const outputPath = path.join(this.outputDir, 'MASTER_DEPENDENCIES.md');
    fs.writeFileSync(outputPath, md, 'utf8');
    console.log(`✅ Generated: ${outputPath}`);
  }
  
  // Helper methods
  getDependenciesForProject(projectName) {
    return this.db.getDependenciesByProject(projectName).map(d => ({
      type: d.dep_type,
      name: d.dep_name,
      version: d.dep_version,
      is_dev: !!d.is_dev
    }));
  }
  
  getModulesForProject(projectName) {
    return this.db.getModulesByProject(projectName).map(m => ({
      name: m.module_name,
      path: m.path,
      language: m.language,
      file_count: m.file_count
    }));
  }
  
  renderCriticality(crit) {
    if (crit === 'P0') return '🔴 P0';
    if (crit === 'P1') return '🟠 P1';
    if (crit === 'P2') return '🟡 P2';
    if (crit === 'P3') return '🟢 P3';
    return '-';
  }
  
  renderGitStatus(project) {
    const status = project.git_status || 'unknown';
    const branch = project.git_branch || '-';
    
    if (status === 'clean') return `🟢 ${branch}`;
    if (status === 'modified') return `🟡 ${branch} (modified)`;
    if (status === 'behind') return `🔵 ${branch} (behind)`;
    if (status === 'ahead') return `🟣 ${branch} (ahead)`;
    if (status === 'git') return `📁 ${branch}`;
    return `❓ ${branch}`;
  }
  
  renderHealth(project) {
    // This would come from Health Engine in production
    // For now, derive from other factors
    const coverage = project.qa_coverage || 0;
    const bugs = project.open_bugs || 0;
    
    if (coverage >= 80 && bugs === 0) return '🟢 Good';
    if (coverage >= 60) return '🟡 Fair';
    return '🔴 At Risk';
  }
}

function depsForProject(depMap, projectName) {
  return depMap.filter(d => d.project_name === projectName);
}

module.exports = { OutputGenerator };
