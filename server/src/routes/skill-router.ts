/**
 * Skill Router API — WS7
 *
 * GET  /api/skills              — list all skills
 * POST /api/skills/execute      — execute a skill { message, store?, language? }
 * GET  /api/skills/match?message=... — check if a skill matches
 */

import { Router, Request, Response } from 'express';
import { findSkill, listSkills, executeSkill } from '../skills/skill-registry';

export const skillRouter = Router();

skillRouter.get('/', (_req: Request, res: Response) => {
  res.json({ skills: listSkills() });
});

skillRouter.post('/execute', async (req: Request, res: Response) => {
  const { message, store, language, context } = req.body as {
    message: string; store?: string; language?: string; context?: string;
  };
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await executeSkill(message, { store, language, context });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

skillRouter.get('/match', (req: Request, res: Response) => {
  const { message } = req.query as { message: string };
  if (!message) return res.status(400).json({ error: 'message required' });
  const skill = findSkill(message);
  res.json({ matched: !!skill, skill: skill?.name || null });
});
