/**
 * KNOWLEDGE QUERY ENGINE
 * CEO Directive Phase 3.1 - Real Data Query
 * 
 * Reads from actual files in MASTER_AUDIT_PACKAGE
 * No hardcoded values - every answer must come from real data
 */

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = 'E:\\Project\\Master\\_exports\\MASTER_AUDIT_PACKAGE';

class KnowledgeQueryEngine {
    constructor() {
        this.data = null;
        this.lastUpdated = null;
        this.loadData();
    }
    
    loadData() {
        try {
            const indexPath = path.join(KNOWLEDGE_DIR, 'MASTER_INDEX.json');
            if (fs.existsSync(indexPath)) {
                const content = fs.readFileSync(indexPath, 'utf8');
                this.data = JSON.parse(content);
                this.lastUpdated = this.data.exportInfo?.generatedAt || new Date().toISOString();
            }
        } catch (e) {
            this.data = null;
        }
    }
    
    /**
     * Refresh data from disk
     */
    refresh() {
        this.loadData();
    }
    
    /**
     * Get evidence metadata for responses
     */
    getEvidence(sourceFile) {
        return {
            source: sourceFile,
            timestamp: this.lastUpdated,
            confidence: this.data ? 'High' : 'Low',
            dataAvailable: !!this.data
        };
    }
    
    /**
     * Query: Count of projects
     */
    queryProjectCount() {
        this.refresh();
        if (!this.data || !this.data.statistics) {
            return {
                answer: 'UNKNOWN - DATA NOT AVAILABLE',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        return {
            answer: `Có **${this.data.statistics.totalProjects} projects** trong hệ thống.`,
            evidence: this.getEvidence('MASTER_INDEX.json'),
            raw: this.data.statistics.totalProjects
        };
    }
    
    /**
     * Query: Largest projects by file count
     */
    queryLargestProjects(limit = 10) {
        this.refresh();
        if (!this.data || !this.data.statistics || !this.data.projects) {
            return {
                answer: 'UNKNOWN - DATA NOT AVAILABLE',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        // Get file counts for each project by scanning directories
        const projectSizes = [];
        for (const project of this.data.projects) {
            try {
                if (fs.existsSync(project.path)) {
                    const stats = this.getDirectoryStats(project.path);
                    projectSizes.push({
                        name: project.name,
                        path: project.path,
                        files: stats.fileCount,
                        size: stats.totalSize
                    });
                }
            } catch (e) {
                // Skip projects we can't access
            }
        }
        
        // Sort by file count
        projectSizes.sort((a, b) => b.files - a.files);
        const top = projectSizes.slice(0, limit);
        
        if (top.length === 0) {
            return {
                answer: 'UNKNOWN - Cannot access project directories',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        const lines = top.map((p, i) => `${i + 1}. **${p.name}** - ${p.files} files (${this.formatBytes(p.size)})`).join('\n');
        
        return {
            answer: `**Top ${top.length} projects lớn nhất (theo số files):**\n\n${lines}`,
            evidence: this.getEvidence('MASTER_INDEX.json'),
            raw: top
        };
    }
    
    /**
     * Query: Projects without Git
     */
    queryProjectsWithoutGit() {
        this.refresh();
        if (!this.data || !this.data.projects) {
            return {
                answer: 'UNKNOWN - DATA NOT AVAILABLE',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        const noGit = [];
        for (const project of this.data.projects) {
            const gitPath = path.join(project.path, '.git');
            if (!fs.existsSync(gitPath)) {
                noGit.push(project.name);
            }
        }
        
        if (noGit.length === 0) {
            return {
                answer: 'Tất cả projects đều có Git.',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: []
            };
        }
        
        return {
            answer: `**${noGit.length} projects không có Git:**\n\n${noGit.map(p => `- ${p}`).join('\n')}`,
            evidence: this.getEvidence('MASTER_INDEX.json'),
            raw: noGit
        };
    }
    
    /**
     * Query: Recent changes from journal
     */
    queryRecentChanges(limit = 10) {
        this.refresh();
        if (!this.data || !this.data.recentEvents) {
            return {
                answer: 'UNKNOWN - DATA NOT AVAILABLE',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        const events = this.data.recentEvents.slice(0, limit);
        
        if (events.length === 0) {
            return {
                answer: 'Không có recent events được ghi nhận.',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: []
            };
        }
        
        const lines = events.map((e, i) => {
            const date = new Date(e.modified).toLocaleString();
            return `${i + 1}. **${e.file}** (${e.source}) - ${date}`;
        }).join('\n');
        
        return {
            answer: `**Recent changes (${events.length} items):**\n\n${lines}`,
            evidence: this.getEvidence('MASTER_INDEX.json'),
            raw: events
        };
    }
    
    /**
     * Query: System health
     */
    queryHealth() {
        this.refresh();
        if (!this.data || !this.data.systemInfo) {
            return {
                answer: 'UNKNOWN - DATA NOT AVAILABLE',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        const engines = this.data.systemInfo.engines || {};
        const specs = this.data.systemInfo.specs || {};
        
        const activeEngines = Object.values(engines).filter(e => e.exists).length;
        const totalEngines = Object.keys(engines).length;
        const implementedSpecs = Object.values(specs).filter(s => s.exists).length;
        const totalSpecs = Object.keys(specs).length;
        
        const healthScore = Math.round(((activeEngines / totalEngines) * 50 + (implementedSpecs / totalSpecs) * 50));
        
        let status = '🟡 Trung bình';
        if (healthScore >= 80) status = '🟢 Tốt';
        else if (healthScore >= 60) status = '🟡 Trung bình';
        else if (healthScore >= 40) status = '🟠 Yếu';
        else status = '🔴 Nguy hiểm';
        
        return {
            answer: `**System Health: ${healthScore}/100 ${status}**\n\n` +
                    `Engines: ${activeEngines}/${totalEngines} active\n` +
                    `Specifications: ${implementedSpecs}/${totalSpecs} implemented`,
            evidence: this.getEvidence('MASTER_INDEX.json'),
            raw: { healthScore, activeEngines, totalEngines, implementedSpecs, totalSpecs }
        };
    }
    
    /**
     * Query: Open bugs
     */
    queryOpenBugs() {
        this.refresh();
        try {
            const bugsPath = path.join(KNOWLEDGE_DIR, 'OPEN_BUGS.md');
            if (fs.existsSync(bugsPath)) {
                const content = fs.readFileSync(bugsPath, 'utf8');
                // Check if there are actual bugs mentioned
                if (content.includes('No open bugs') || content.includes('0 open bugs')) {
                    return {
                        answer: '**0 open bugs** - Không có bugs nào được ghi nhận.',
                        evidence: this.getEvidence('OPEN_BUGS.md'),
                        raw: []
                    };
                }
                return {
                    answer: content.substring(0, 500),
                    evidence: this.getEvidence('OPEN_BUGS.md'),
                    raw: content
                };
            }
        } catch (e) {
            // Fall through to unknown
        }
        
        return {
            answer: 'UNKNOWN - Bug tracking chưa được tích hợp.',
            evidence: this.getEvidence('OPEN_BUGS.md'),
            raw: null
        };
    }
    
    /**
     * Query: File type distribution
     */
    queryFileTypes() {
        this.refresh();
        if (!this.data || !this.data.statistics || !this.data.statistics.byType) {
            return {
                answer: 'UNKNOWN - DATA NOT AVAILABLE',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        const byType = this.data.statistics.byType;
        const entries = Object.entries(byType)
            .map(([ext, data]) => ({ ext, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        const lines = entries.map(e => `- ${e.ext || '(no ext)'}: ${e.count} files`).join('\n');
        
        return {
            answer: `**Top 10 file types:**\n\n${lines}`,
            evidence: this.getEvidence('MASTER_INDEX.json'),
            raw: entries
        };
    }
    
    /**
     * Query: Projects depending on a specific project
     */
    queryProjectsDependingOn(targetProject) {
        this.refresh();
        if (!this.data || !this.data.projects) {
            return {
                answer: 'UNKNOWN - DATA NOT AVAILABLE',
                evidence: this.getEvidence('MASTER_INDEX.json'),
                raw: null
            };
        }
        
        // Simple heuristic: look for references in dependency files
        const depending = [];
        try {
            const depPath = path.join(KNOWLEDGE_DIR, 'MASTER_DEPENDENCIES.md');
            if (fs.existsSync(depPath)) {
                const content = fs.readFileSync(depPath, 'utf8').toLowerCase();
                const target = targetProject.toLowerCase();
                
                for (const project of this.data.projects) {
                    if (project.name.toLowerCase().includes(target) || content.includes(target)) {
                        depending.push(project.name);
                    }
                }
            }
        } catch (e) {
            // Fall through
        }
        
        if (depending.length === 0) {
            return {
                answer: `Không tìm thấy projects phụ thuộc "${targetProject}".`,
                evidence: this.getEvidence('MASTER_DEPENDENCIES.md'),
                raw: []
            };
        }
        
        return {
            answer: `**Projects phụ thuộc "${targetProject}":**\n\n${depending.map(p => `- ${p}`).join('\n')}`,
            evidence: this.getEvidence('MASTER_DEPENDENCIES.md'),
            raw: depending
        };
    }
    
    /**
     * Get directory statistics
     */
    getDirectoryStats(dirPath, depth = 0, maxDepth = 3) {
        const stats = { fileCount: 0, totalSize: 0 };
        
        if (depth > maxDepth) return stats;
        
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.name === '.git' || entry.name === 'node_modules') continue;
                
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    const subStats = this.getDirectoryStats(fullPath, depth + 1, maxDepth);
                    stats.fileCount += subStats.fileCount;
                    stats.totalSize += subStats.totalSize;
                } else if (entry.isFile()) {
                    try {
                        const fileStats = fs.statSync(fullPath);
                        stats.fileCount++;
                        stats.totalSize += fileStats.size;
                    } catch (e) {
                        // Skip
                    }
                }
            }
        } catch (e) {
            // Skip inaccessible directories
        }
        
        return stats;
    }
    
    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Query by question type
     */
    query(question) {
        const lower = question.toLowerCase();
        
        if (lower.includes('bao nhiêu') && (lower.includes('project') || lower.includes('dự án'))) {
            return this.queryProjectCount();
        }
        
        if (lower.includes('how many') && (lower.includes('project'))) {
            return this.queryProjectCount();
        }
        
        if (lower.includes('lớn nhất') || (lower.includes('largest') && lower.includes('project'))) {
            return this.queryLargestProjects();
        }
        
        if (lower.includes('top') && lower.includes('largest')) {
            const match = lower.match(/top\s+(\d+)/);
            const limit = match ? parseInt(match[1]) : 10;
            return this.queryLargestProjects(limit);
        }
        
        if ((lower.includes('không có git') || lower.includes('without git')) && 
            (lower.includes('project') || lower.includes('dự án'))) {
            return this.queryProjectsWithoutGit();
        }
        
        if (lower.includes('gần đây') || lower.includes('recent') || lower.includes('thay đổi')) {
            return this.queryRecentChanges();
        }
        
        if (lower.includes('health') || lower.includes('sức khỏe') || lower.includes('trạng thái')) {
            return this.queryHealth();
        }
        
        if (lower.includes('bug') || lower.includes('lỗi')) {
            return this.queryOpenBugs();
        }
        
        if (lower.includes('file') && (lower.includes('type') || lower.includes('loại'))) {
            return this.queryFileTypes();
        }
        
        if (lower.includes('phụ thuộc') || lower.includes('depending')) {
            const match = lower.match(/agent\s*core|agent\s*os|project\s+(\w+)/i);
            const target = match ? match[1] || 'Agent' : 'Agent';
            return this.queryProjectsDependingOn(target);
        }
        
        return null;
    }
}

module.exports = { KnowledgeQueryEngine };
