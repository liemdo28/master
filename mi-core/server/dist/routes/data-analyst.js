"use strict";
/**
 * Data Analyst API Routes
 * GET  /api/data-analyst/health   — health check
 * GET  /api/data-analyst/datasets — list all datasets
 * GET  /api/data-analyst/last     — get last analysis for a dataset
 * POST /api/data-analyst/upload   — upload and ingest a file (multipart)
 * POST /api/data-analyst/analyze  — analyze a local file path
 * POST /api/data-analyst/question — ask a question about a file
 * POST /api/data-analyst/report   — generate full report for a file
 * POST /api/data-analyst/quick    — quick analyze + opportunities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataAnalystRouter = void 0;
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const data_analyst_engine_1 = require("../data-analyst/data-analyst-engine");
const dataset_catalog_1 = require("../data-analyst/dataset-catalog");
exports.dataAnalystRouter = (0, express_1.Router)();
const engine = new data_analyst_engine_1.DataAnalystEngine();
const UPLOAD_DIR = path_1.default.join(process.cwd(), '.local-agent-global', 'data-analyst', 'uploads');
const upload = (0, multer_1.default)({
    dest: UPLOAD_DIR,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['.csv', '.xlsx', '.xls', '.json', '.pdf', '.docx', '.doc'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    },
});
if (!fs_1.default.existsSync(UPLOAD_DIR))
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
// GET /api/data-analyst/health
exports.dataAnalystRouter.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        module: 'data-analyst',
        engine: 'DataAnalystEngine (TypeScript native)',
        supported_formats: ['csv', 'xlsx', 'xls', 'json', 'pdf', 'docx'],
        endpoints: [
            'GET  /health',
            'GET  /datasets',
            'GET  /last?dataset_id=',
            'POST /upload  (multipart file)',
            'POST /analyze { file_path, analysis_type }',
            'POST /question { file_path, question }',
            'POST /report   { file_path, format }',
            'POST /quick    { file_path }',
        ],
        timestamp: new Date().toISOString(),
    });
});
// GET /api/data-analyst/datasets
exports.dataAnalystRouter.get('/datasets', (_req, res) => {
    res.json((0, dataset_catalog_1.listDatasets)());
});
// GET /api/data-analyst/last?dataset_id=ds_xxx
exports.dataAnalystRouter.get('/last', (req, res) => {
    const { dataset_id } = req.query;
    if (!dataset_id)
        return res.status(400).json({ error: 'dataset_id query param required' });
    const result = engine.getLastAnalysis(dataset_id);
    if (!result)
        return res.json({ error: 'No analysis found for this dataset' });
    res.json(result);
});
// POST /api/data-analyst/upload
exports.dataAnalystRouter.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'No file uploaded. Use multipart/form-data with field "file"' });
    const ext = path_1.default.extname(req.file.originalname).toLowerCase();
    const destPath = req.file.path + ext;
    fs_1.default.renameSync(req.file.path, destPath);
    const result = await engine.ingest(destPath);
    if (!result.success)
        return res.status(400).json(result);
    res.json({ ...result, upload_path: destPath });
});
// POST /api/data-analyst/analyze
exports.dataAnalystRouter.post('/analyze', async (req, res) => {
    const { file_path, dataset_id, analysis_type = 'full_report' } = req.body;
    if (!file_path && !dataset_id)
        return res.status(400).json({ error: 'file_path or dataset_id required' });
    if (file_path && !fs_1.default.existsSync(file_path))
        return res.status(404).json({ error: `File not found: ${file_path}` });
    const result = await engine.analyze({ file_path, dataset_id, analysis_type: analysis_type });
    if (!result.success)
        return res.status(400).json(result);
    res.json(result);
});
// POST /api/data-analyst/question
exports.dataAnalystRouter.post('/question', async (req, res) => {
    const { file_path, question } = req.body;
    if (!question)
        return res.status(400).json({ error: 'question required' });
    if (!file_path)
        return res.status(400).json({ error: 'file_path required' });
    if (!fs_1.default.existsSync(file_path))
        return res.status(404).json({ error: `File not found: ${file_path}` });
    const result = await engine.answerQuestion(file_path, question);
    res.json(result);
});
// POST /api/data-analyst/report
exports.dataAnalystRouter.post('/report', async (req, res) => {
    const { file_path, format = 'markdown' } = req.body;
    if (!file_path)
        return res.status(400).json({ error: 'file_path required' });
    if (!fs_1.default.existsSync(file_path))
        return res.status(404).json({ error: `File not found: ${file_path}` });
    const result = await engine.analyze({ file_path, analysis_type: 'full_report' });
    if (!result.success)
        return res.status(400).json(result);
    if (format === 'json')
        return res.json(result);
    const report = result.result?.report_text || '';
    res.json({ format: 'markdown', report, file: file_path, generated_at: new Date().toISOString() });
});
// POST /api/data-analyst/quick
exports.dataAnalystRouter.post('/quick', async (req, res) => {
    const { file_path } = req.body;
    if (!file_path)
        return res.status(400).json({ error: 'file_path required' });
    if (!fs_1.default.existsSync(file_path))
        return res.status(404).json({ error: `File not found: ${file_path}` });
    const result = await engine.quickAnalyze(file_path);
    res.json(result);
});
