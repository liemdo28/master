"use strict";
/**
 * Data Analyst API Routes
 * POST /api/data-analyst/analyze — analyze a local file
 * POST /api/data-analyst/question — ask a question about loaded data
 * GET  /api/data-analyst/datasets — list all datasets
 * GET  /api/data-analyst/last — get last analysis
 */
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataAnalystRouter = void 0;
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CATALOG_FILE = path_1.default.join(GLOBAL_DIR, 'data-analyst', 'dataset_catalog.json');
const LAST_ANALYSIS_FILE = path_1.default.join(GLOBAL_DIR, 'data-analyst', 'last_analysis.json');
exports.dataAnalystRouter = (0, express_1.Router)();
// Load JS engine lazily
let engine = null;
async function getEngine() {
    if (!engine) {
        const enginePath = path_1.default.resolve('E:/Project/Master/mi-core/local-agent/data-analyst/DataAnalystEngine.mjs');
        engine = await Promise.resolve(`${(0, url_1.pathToFileURL)(enginePath).href}`).then(s => __importStar(require(s)));
    }
    return engine;
}
// GET /api/data-analyst/datasets
exports.dataAnalystRouter.get('/datasets', (_req, res) => {
    try {
        const catalog = JSON.parse(fs_1.default.readFileSync(CATALOG_FILE, 'utf-8'));
        res.json(catalog);
    }
    catch {
        res.json({ datasets: [], message: 'No datasets yet' });
    }
});
// GET /api/data-analyst/last
exports.dataAnalystRouter.get('/last', (_req, res) => {
    try {
        const last = JSON.parse(fs_1.default.readFileSync(LAST_ANALYSIS_FILE, 'utf-8'));
        res.json(last);
    }
    catch {
        res.json({ error: 'No analysis yet', hint: 'POST /api/data-analyst/analyze with { file_path }' });
    }
});
// POST /api/data-analyst/analyze
exports.dataAnalystRouter.post('/analyze', async (req, res) => {
    const { file_path, store, period } = req.body;
    if (!file_path) {
        return res.status(400).json({ error: 'file_path required' });
    }
    if (!fs_1.default.existsSync(file_path)) {
        return res.status(404).json({ error: `File not found: ${file_path}` });
    }
    try {
        const mod = await getEngine();
        const DataAnalystEngine = mod['DataAnalystEngine'];
        const eng = new DataAnalystEngine();
        const result = await eng.analyze(file_path, { store, period });
        if (!result['success']) {
            return res.status(400).json(result);
        }
        const report = eng.report();
        res.json({ ...result, report_text: report });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
// POST /api/data-analyst/question
exports.dataAnalystRouter.post('/question', async (req, res) => {
    const { file_path, question } = req.body;
    if (!question)
        return res.status(400).json({ error: 'question required' });
    try {
        const mod = await getEngine();
        const quickAnalyze = mod['quickAnalyze'];
        if (file_path) {
            const result = await quickAnalyze(file_path, question);
            return res.json(result);
        }
        // Use last analysis if no file provided
        if (!fs_1.default.existsSync(LAST_ANALYSIS_FILE)) {
            return res.json({
                answer: 'Chưa có dữ liệu. Upload file trước: POST /api/data-analyst/analyze',
            });
        }
        // For saved datasets, we'd need to reload — for now return hint
        res.json({
            note: 'Provide file_path to analyze, or use chat interface for AI-powered questions.',
            question,
            hint: 'POST /api/data-analyst/analyze first, then POST /api/data-analyst/question with file_path',
        });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
// POST /api/data-analyst/report
exports.dataAnalystRouter.post('/report', async (req, res) => {
    const { file_path, format = 'markdown' } = req.body;
    if (!file_path)
        return res.status(400).json({ error: 'file_path required' });
    try {
        const mod = await getEngine();
        const DataAnalystEngine = mod['DataAnalystEngine'];
        const eng = new DataAnalystEngine();
        const result = await eng.analyze(file_path, {});
        if (!result['success'])
            return res.status(400).json(result);
        const report = eng.report();
        if (format === 'json') {
            return res.json({ report: result['analytics'], generated_at: new Date().toISOString() });
        }
        res.json({
            format: 'markdown',
            report,
            file: file_path,
            generated_at: new Date().toISOString(),
        });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
