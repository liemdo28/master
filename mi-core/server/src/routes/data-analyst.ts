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

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { DataAnalystEngine } from '../data-analyst/data-analyst-engine';
import { listDatasets } from '../data-analyst/dataset-catalog';

export const dataAnalystRouter = Router();

const engine = new DataAnalystEngine();

const UPLOAD_DIR = path.join(process.cwd(), '.local-agent-global', 'data-analyst', 'uploads');
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls', '.json', '.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// GET /api/data-analyst/health
dataAnalystRouter.get('/health', (_req: Request, res: Response) => {
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
dataAnalystRouter.get('/datasets', (_req: Request, res: Response) => {
  res.json(listDatasets());
});

// GET /api/data-analyst/last?dataset_id=ds_xxx
dataAnalystRouter.get('/last', (req: Request, res: Response) => {
  const { dataset_id } = req.query as { dataset_id?: string };
  if (!dataset_id) return res.status(400).json({ error: 'dataset_id query param required' });
  const result = engine.getLastAnalysis(dataset_id);
  if (!result) return res.json({ error: 'No analysis found for this dataset' });
  res.json(result);
});

// POST /api/data-analyst/upload
dataAnalystRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Use multipart/form-data with field "file"' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const destPath = req.file.path + ext;
  fs.renameSync(req.file.path, destPath);

  const result = await engine.ingest(destPath);
  if (!result.success) return res.status(400).json(result);
  res.json({ ...result, upload_path: destPath });
});

// POST /api/data-analyst/analyze
dataAnalystRouter.post('/analyze', async (req: Request, res: Response) => {
  const { file_path, dataset_id, analysis_type = 'full_report' } = req.body as {
    file_path?: string; dataset_id?: string; analysis_type?: string;
  };

  if (!file_path && !dataset_id) return res.status(400).json({ error: 'file_path or dataset_id required' });
  if (file_path && !fs.existsSync(file_path)) return res.status(404).json({ error: `File not found: ${file_path}` });

  const result = await engine.analyze({ file_path, dataset_id, analysis_type: analysis_type as never });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// POST /api/data-analyst/question
dataAnalystRouter.post('/question', async (req: Request, res: Response) => {
  const { file_path, question } = req.body as { file_path?: string; question: string };

  if (!question) return res.status(400).json({ error: 'question required' });
  if (!file_path) return res.status(400).json({ error: 'file_path required' });
  if (!fs.existsSync(file_path)) return res.status(404).json({ error: `File not found: ${file_path}` });

  const result = await engine.answerQuestion(file_path, question);
  res.json(result);
});

// POST /api/data-analyst/report
dataAnalystRouter.post('/report', async (req: Request, res: Response) => {
  const { file_path, format = 'markdown' } = req.body as { file_path?: string; format?: string };
  if (!file_path) return res.status(400).json({ error: 'file_path required' });
  if (!fs.existsSync(file_path)) return res.status(404).json({ error: `File not found: ${file_path}` });

  const result = await engine.analyze({ file_path, analysis_type: 'full_report' });
  if (!result.success) return res.status(400).json(result);

  if (format === 'json') return res.json(result);
  const report = (result.result as { report_text?: string })?.report_text || '';
  res.json({ format: 'markdown', report, file: file_path, generated_at: new Date().toISOString() });
});

// POST /api/data-analyst/quick
dataAnalystRouter.post('/quick', async (req: Request, res: Response) => {
  const { file_path } = req.body as { file_path?: string };
  if (!file_path) return res.status(400).json({ error: 'file_path required' });
  if (!fs.existsSync(file_path)) return res.status(404).json({ error: `File not found: ${file_path}` });

  const result = await engine.quickAnalyze(file_path);
  res.json(result);
});
