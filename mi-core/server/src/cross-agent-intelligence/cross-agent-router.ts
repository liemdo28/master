import { Router } from 'express';
import { runRawSushiRevenueObjective } from './cross-agent-orchestrator';
const router=Router();
router.get('/status',(_req,res)=>res.json({status:'CROSS_AGENT_READY'}));
router.post('/raw-sushi-revenue-10',(_req,res)=>res.json(runRawSushiRevenueObjective()));
export default router;
