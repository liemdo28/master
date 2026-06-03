"use strict";
// ============================================================
// Agent OS - Control Plane - Project Routes
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../services/database");
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const router = (0, express_1.Router)();
// Default scan paths
const SCAN_PATHS = [
    'E:\\Project\\Master',
    'D:\\',
    'F:\\',
    'G:\\My Drive',
];
// Get all projects
router.get('/', (req, res) => {
    const projects = database_1.projectDb.findAll().map((p) => formatProject(p));
    res.json({ projects });
});
// Trigger project scan
router.post('/scan', async (req, res) => {
    const { paths } = req.body;
    const scanPaths = paths || SCAN_PATHS;
    console.log('[Scan] Starting project discovery scan...');
    const discovered = [];
    for (const basePath of scanPaths) {
        try {
            if (!fs.existsSync(basePath)) {
                console.log(`[Scan] Path not found: ${basePath}`);
                continue;
            }
            const projects = await scanDirectory(basePath);
            for (const project of projects) {
                database_1.projectDb.upsert(project);
                discovered.push(formatProject(project));
            }
        }
        catch (err) {
            console.error(`[Scan] Error scanning ${basePath}:`, err);
        }
    }
    console.log(`[Scan] Discovered ${discovered.length} projects`);
    res.json({ projects: discovered, count: discovered.length });
});
async function scanDirectory(dir) {
    const projects = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name.startsWith('.') || entry.name.startsWith('node_modules'))
                continue;
            const fullPath = path.join(dir, entry.name);
            // Check for project indicators
            const hasGit = fs.existsSync(path.join(fullPath, '.git'));
            const hasNodeModules = fs.existsSync(path.join(fullPath, 'node_modules'));
            const hasPackageJson = fs.existsSync(path.join(fullPath, 'package.json'));
            const hasComposerJson = fs.existsSync(path.join(fullPath, 'composer.json'));
            const hasRequirements = fs.existsSync(path.join(fullPath, 'requirements.txt'));
            const hasDockerfile = fs.existsSync(path.join(fullPath, 'Dockerfile'));
            const hasGoMod = fs.existsSync(path.join(fullPath, 'go.mod'));
            const hasCargoToml = fs.existsSync(path.join(fullPath, 'Cargo.toml'));
            if (hasGit || hasPackageJson || hasComposerJson || hasRequirements || hasGoMod || hasCargoToml) {
                const languages = [];
                const frameworks = [];
                // Detect languages
                if (hasPackageJson) {
                    languages.push('JavaScript/TypeScript');
                    const pkg = JSON.parse(fs.readFileSync(path.join(fullPath, 'package.json'), 'utf-8'));
                    frameworks.push(...Object.keys({
                        ...(pkg.dependencies || {}),
                        ...(pkg.devDependencies || {}),
                    }).filter(dep => ['react', 'vue', 'angular', 'next', 'nuxt', 'express', 'nest', 'svelte'].some(f => dep.includes(f))));
                }
                if (hasComposerJson) {
                    languages.push('PHP');
                    const composer = JSON.parse(fs.readFileSync(path.join(fullPath, 'composer.json'), 'utf-8'));
                    frameworks.push(...Object.keys(composer.require || {}).filter(dep => ['laravel', 'symfony', 'wordpress', 'drupal'].some(f => dep.includes(f))));
                }
                if (hasRequirements) {
                    languages.push('Python');
                }
                if (hasGoMod)
                    languages.push('Go');
                if (hasCargoToml)
                    languages.push('Rust');
                let packageManager;
                if (hasPackageJson)
                    packageManager = 'npm';
                else if (hasComposerJson)
                    packageManager = 'composer';
                else if (hasRequirements)
                    packageManager = 'pip';
                else if (hasGoMod)
                    packageManager = 'go';
                else if (hasCargoToml)
                    packageManager = 'cargo';
                let lastModified;
                try {
                    const stat = fs.statSync(fullPath);
                    lastModified = stat.mtime.toISOString();
                }
                catch { }
                projects.push({
                    id: (0, uuid_1.v4)(),
                    name: entry.name,
                    path: fullPath,
                    languages: JSON.stringify(languages),
                    frameworks: JSON.stringify(frameworks),
                    hasGit,
                    hasDocker: hasDockerfile,
                    hasNodeModules,
                    packageManager,
                    lastModified,
                    discoveredAt: new Date().toISOString(),
                });
            }
        }
    }
    catch (err) {
        console.error(`[Scan] Error reading directory ${dir}:`, err);
    }
    return projects;
}
function formatProject(p) {
    return {
        id: p.id,
        name: p.name,
        path: p.path,
        languages: JSON.parse(p.languages || '[]'),
        frameworks: JSON.parse(p.frameworks || '[]'),
        hasGit: Boolean(p.has_git),
        hasDocker: Boolean(p.has_docker),
        hasNodeModules: Boolean(p.has_node_modules),
        packageManager: p.package_manager,
        lastModified: p.last_modified,
        discoveredAt: p.discovered_at,
    };
}
exports.default = router;
//# sourceMappingURL=projects.js.map