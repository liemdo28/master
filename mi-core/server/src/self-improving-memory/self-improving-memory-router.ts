import { Router } from 'express';
import { rememberOutcome, rememberFailure, rememberApproval, replayDecision, getRecommendations } from './index';
const router = Router();
router.post('/outcome', (req, res) => res.json(rememberOutcome(req.body)));
router.post('/failure', (req, res) => res.json(rememberFailure(req.body)));
router.post('/approval', (req, res) => res.json(rememberApproval(req.body)));
router.post('/replay', (req, res) => res.json(replayDecision(req.body?.case || req.body?.caseName || 'DoorDash timeout')));
router.get('/recommendations', (_req, res) => res.json({ status: 'SELF_IMPROVING_READY', recommendations: getRecommendations() }));
export default router;
