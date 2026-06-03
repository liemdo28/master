// ============================================================
// Agent OS - Snapshot Routes
// ============================================================

import { Router, Request, Response } from 'express';
import { createMasterSnapshot } from '../services/snapshotService';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const snapshot = createMasterSnapshot(req.body.reason || 'manual snapshot', req.body.taskId);
    res.status(201).json({ snapshot });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
