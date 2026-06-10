"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
const express_1 = require("express");
const owner_profile_1 = require("../services/owner-profile");
exports.profileRouter = (0, express_1.Router)();
exports.profileRouter.get('/', (_req, res) => {
    res.json(owner_profile_1.ownerProfile.getAll());
});
exports.profileRouter.get('/health', (_req, res) => {
    res.json(owner_profile_1.ownerProfile.getHealth());
});
exports.profileRouter.get('/consent-log', (_req, res) => {
    res.json(owner_profile_1.ownerProfile.getConsentLog());
});
exports.profileRouter.post('/remember', (req, res) => {
    const { category, key, value } = req.body;
    if (!category || !key || value === undefined) {
        return res.status(400).json({ error: 'category, key, value required' });
    }
    owner_profile_1.ownerProfile.remember(category, key, value);
    res.json({ ok: true, saved: { category, key, value } });
});
exports.profileRouter.delete('/forget', (req, res) => {
    const { category, key } = req.body;
    if (!category)
        return res.status(400).json({ error: 'category required' });
    owner_profile_1.ownerProfile.forget(category, key);
    res.json({ ok: true, deleted: { category, key } });
});
