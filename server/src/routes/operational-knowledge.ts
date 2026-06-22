import { Router, Request, Response } from 'express';
import {
  enrichWorkOrder,
  getProjectIntelligence,
  getOperationalEntities,
  getOperationalMemoryIndex,
  recommendOperationalSkills,
  classifyOperationalRisk,
  recommendOperationalRole,
  generateExecutionPackage,
  calculateReadinessScore,
} from '../operational/work-order-knowledge-service';

export const operationalKnowledgeRouter = Router();

// GET /api/work-orders/enrich?input=Mi%20oi%20kiem%20tra%20Dashboard
operationalKnowledgeRouter.get('/work-orders/enrich', (req: Request, res: Response) => {
  const { input, raw_request, work_order_type, target_project } = req.query as Record<string, string>;
  const message = input || raw_request || work_order_type || '';
  if (!message.trim()) return res.status(400).json({ error: 'input, raw_request, or work_order_type required' });
  res.json(enrichWorkOrder({ input, raw_request, work_order_type, target_project }));
});

// GET /api/execution-package?input=Mi%20oi%20kiem%20tra%20Dashboard
operationalKnowledgeRouter.get('/execution-package', (req: Request, res: Response) => {
  const { input, raw_request, work_order_type, target_project } = req.query as Record<string, string>;
  const message = input || raw_request || work_order_type || '';
  if (!message.trim()) return res.status(400).json({ error: 'input, raw_request, or work_order_type required' });
  res.json(generateExecutionPackage({ input, raw_request, work_order_type, target_project }));
});

// GET /api/projects/intelligence?project=dashboard
operationalKnowledgeRouter.get('/projects/intelligence', (req: Request, res: Response) => {
  const { project, q } = req.query as Record<string, string>;
  res.json(getProjectIntelligence(project || q));
});

// GET /api/entities/operational
operationalKnowledgeRouter.get('/entities/operational', (_req: Request, res: Response) => {
  res.json(getOperationalEntities());
});

// GET /api/operational-memory?query=dashboard%20incident
operationalKnowledgeRouter.get('/operational-memory', (req: Request, res: Response) => {
  const { query, q } = req.query as Record<string, string>;
  res.json(getOperationalMemoryIndex(query || q));
});

// GET /api/skills/recommend?input=dashboard_audit
operationalKnowledgeRouter.get('/skills/recommend', (req: Request, res: Response) => {
  const { input, work_order_type, target_project } = req.query as Record<string, string>;
  const message = input || work_order_type || '';
  if (!message.trim()) return res.status(400).json({ error: 'input or work_order_type required' });
  res.json({
    input: message,
    target_project: target_project || null,
    skills: recommendOperationalSkills(message, target_project),
  });
});

// GET /api/risks/classify?input=production%20deploy
operationalKnowledgeRouter.get('/risks/classify', (req: Request, res: Response) => {
  const { input, work_order_type, target_project } = req.query as Record<string, string>;
  const message = input || work_order_type || '';
  if (!message.trim()) return res.status(400).json({ error: 'input or work_order_type required' });
  res.json({
    input: message,
    target_project: target_project || null,
    ...classifyOperationalRisk(message, target_project),
  });
});

// GET /api/roles/recommend?input=dashboard_audit
operationalKnowledgeRouter.get('/roles/recommend', (req: Request, res: Response) => {
  const { input, work_order_type } = req.query as Record<string, string>;
  const message = input || work_order_type || '';
  if (!message.trim()) return res.status(400).json({ error: 'input or work_order_type required' });
  res.json({
    input: message,
    work_order_type: work_order_type || null,
    ...recommendOperationalRole(message, work_order_type),
  });
});

// GET /api/readiness-score?input=Mi%20oi%20kiem%20tra%20Dashboard
operationalKnowledgeRouter.get('/readiness-score', (req: Request, res: Response) => {
  const { input, work_order_type, target_project } = req.query as Record<string, string>;
  const message = input || work_order_type || '';
  if (!message.trim()) return res.status(400).json({ error: 'input or work_order_type required' });
  res.json({
    input: message,
    target_project: target_project || null,
    readiness_score: calculateReadinessScore({ input, work_order_type, target_project }),
  });
});
