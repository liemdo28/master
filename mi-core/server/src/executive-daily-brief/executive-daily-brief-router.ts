import { Router } from 'express';
import { generateDailyBrief } from './daily-brief-generator';
const router=Router();
router.get('/daily-brief',(_req,res)=>res.json({ok:true,brief:generateDailyBrief()}));
export default router;
