/**
 * Data Analyst API Routes
 * POST /api/data-analyst/analyze — analyze a local file
 * POST /api/data-analyst/question — ask a question about loaded data
 * GET  /api/data-analyst/datasets — list all datasets
 * GET  /api/data-analyst/last — get last analysis
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CATALOG_FILE = path.join(GLOBAL_DIR, 'data-analyst', 'dataset_catalog.json');
const LAST_ANALYSIS_FILE = path.join(GLOBAL_DIR, 'data-analyst', 'last_analysis.json');

export const dataAnalystRouter = Router();

// Load JS engine lazily
let engine: Record<string, unknown> | null = null;

async function getEngine() {
  if (!engine) {
    const enginePath = path.resolve('E:/Project/Master/mi-core/local-agent/data-analyst/DataAnalystEngine.mjs');
    engine = await import(pathToFileURL(enginePath).href) as Record<string, unknown>;
  }
  return engine;
}

// GET /api/data-analyst/datasets
dataAnalystRouter.get('/datasets', (_req: Request, res: Response) => {
  try {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
    res.json(catalog);
  } catch {
    res.json({ datasets: [], message: 'No datasets yet' });
  }
});

// GET /api/data-analyst/last
dataAnalystRouter.get('/last', (_req: Request, res: Response) => {
  try {
    const last = JSON.parse(fs.readFileSync(LAST_ANALYSIS_FILE, 'utf-8'));
    res.json(last);
  } catch {
    res.json({ error: 'No analysis yet', hint: 'POST /api/data-analyst/analyze with { file_path }' });
  }
});

// POST /api/data-analyst/analyze
dataAnalystRouter.post('/analyze', async (req: Request, res: Response) => {
  const { file_path, store, period } = req.body as { file_path?: string; store?: string; period?: string };

  if (!file_path) {
    return res.status(400).json({ error: 'file_path required' });
  }

  if (!fs.existsSync(file_path)) {
    return res.status(404).json({ error: `File not found: ${file_path}` });
  }

  try {
    const mod = await getEngine();
    const DataAnalystEngine = mod['DataAnalystEngine'] as new () => { analyze: (f: string, opts: object) => Promise<Record<string, unknown>>; report: () => string };
    const eng = new DataAnalystEngine();
    const result = await eng.analyze(file_path, { store, period });

    if (!result['success']) {
      return res.status(400).json(result);
    }

    const report = eng.report();
    res.json({ ...result, report_text: report });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/data-analyst/question
dataAnalystRouter.post('/question', async (req: Request, res: Response) => {
  const { file_path, question } = req.body as { file_path?: string; question: string };

  if (!question) return res.status(400).json({ error: 'question required' });

  try {
    const mod = await getEngine();
    const quickAnalyze = mod['quickAnalyze'] as (f: string, q: string) => Promise<Record<string, unknown>>;

    if (file_path) {
      const result = await quickAnalyze(file_path, question);
      return res.json(result);
    }

    // Use last analysis if no file provided
    if (!fs.existsSync(LAST_ANALYSIS_FILE)) {
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
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/data-analyst/report
dataAnalystRouter.post('/report', async (req: Request, res: Response) => {
  const { file_path, format = 'markdown' } = req.body as { file_path?: string; format?: string };

  if (!file_path) return res.status(400).json({ error: 'file_path required' });

  try {
    const mod = await getEngine();
    const DataAnalystEngine = mod['DataAnalystEngine'] as new () => { analyze: (f: string, opts: object) => Promise<Record<string, unknown>>; report: () => string };
    const eng = new DataAnalystEngine();
    const result = await eng.analyze(file_path, {});
    if (!result['success']) return res.status(400).json(result);

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
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
