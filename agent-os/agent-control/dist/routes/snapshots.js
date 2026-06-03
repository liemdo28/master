"use strict";
// ============================================================
// Agent OS - Snapshot Routes
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const snapshotService_1 = require("../services/snapshotService");
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    try {
        const snapshot = (0, snapshotService_1.createMasterSnapshot)(req.body.reason || 'manual snapshot', req.body.taskId);
        res.status(201).json({ snapshot });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=snapshots.js.map