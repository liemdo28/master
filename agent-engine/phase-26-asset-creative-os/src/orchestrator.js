/**
 * Phase 26 — Asset & Creative Production OS.
 * Manages photos, videos, social posts, DoorDash assets, brand consistency,
 * and creative requests. Approval-aware: all creative output drafted, not auto-published.
 * Modules: AssetRegistry · CreativeBriefEngine · BrandComplianceEngine · MediaProductionRouter
 *          · AssetApprovalEngine · CreativeScorecard
 * OSS: ComfyUI (TCP 8188) / fallback: in-engine classes.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class AssetRegistry {
  constructor(opts) { this.store = new JsonStore('asset-registry', opts); }
  register(a) {
    return this.store.insert({
      id: makeId('ASSET'), timestamp: Date.now(), assetId: a.assetId, type: a.type,
      brand: a.brand, platform: a.platform || null, status: 'draft', url: a.url || null,
      complianceStatus: 'pending_review',
    });
  }
  all() { return this.store.all(); }
  pending() { return this.store.filter((a) => a.status === 'draft' || a.status === 'pending_approval'); }
  approved() { return this.store.filter((a) => a.status === 'published' || a.status === 'approved'); }
}

export class CreativeBriefEngine {
  constructor(opts) { this.store = new JsonStore('creative-briefs', opts); }
  create(brief) {
    return this.store.insert({
      id: makeId('BRIEF'), timestamp: Date.now(), requestId: brief.requestId, brand: brief.brand,
      platform: brief.platform, goal: brief.goal, tone: brief.tone || 'friendly',
      deadline: brief.deadline || null, status: 'open', assets: [],
    });
  }
  linkAsset(briefId, assetId) {
    const b = this.store.find((r) => r.id === briefId);
    if (b) { b.assets.push(assetId); this.store.update(b.id, { assets: b.assets }); }
    return b;
  }
  all() { return this.store.all(); }
}

export class BrandComplianceEngine {
  review({ text, type }) {
    const DISALLOWED = ['cheap', 'best ever', 'guaranteed cure', 'weight loss miracle'];
    const REQUIRED_COPY = { social: ['hashtag', 'call-to-action'], copy: ['price', 'offer'], ad: ['headline', 'cta', 'disclaimer'] };
    const flags = [];
    const lc = (text || '').toLowerCase();
    for (const word of DISALLOWED) { if (lc.includes(word)) flags.push('disallowed: ' + word); }
    const req = REQUIRED_COPY[type] || REQUIRED_COPY.copy;
    for (const el of req) { if (!lc.includes(el)) flags.push('missing: ' + el); }
    return { compliant: flags.length === 0, flags, level: flags.length === 0 ? 'CLEAR' : flags.length === 1 ? 'MINOR' : 'MAJOR' };
  }
}

export class MediaProductionRouter {
  route(request) {
    const lanes = { doordash: 'doordash-asset', website: 'web-copy', social: 'social-post', video: 'video-production', print: 'print-production' };
    const lane = lanes[request.type] || 'general-creative';
    const division = request.type === 'social' || request.type === 'video' ? 'creative' : 'marketing';
    return { lane, division, requestId: request.requestId };
  }
}

export class AssetApprovalEngine {
  constructor(opts) { this.store = new JsonStore('asset-approvals', opts); }
  request(assetId, notes) { return this.store.insert({ id: makeId('APPR'), timestamp: Date.now(), assetId, status: 'pending_approval', notes }); }
  approve(assetId) { const a = this.store.find((r) => r.assetId === assetId); if (a) this.store.update(a.id, { status: 'approved' }); return a; }
  reject(assetId, reason) { const a = this.store.find((r) => r.assetId === assetId); if (a) this.store.update(a.id, { status: 'rejected', reason }); return a; }
  pending() { return this.store.filter((r) => r.status === 'pending_approval'); }
  all() { return this.store.all(); }
}

export class CreativeScorecard {
  dashboard(registry) {
    const total = registry.all().length;
    const pending = registry.pending().length;
    const approved = registry.approved().length;
    return {
      total, pending, approved,
      status: pending > 2 ? 'BACKLOG' : pending > 0 ? 'WATCH' : 'CLEAR',
      completionRate: total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0,
    };
  }
}

export class AssetCreativeOS {
  constructor(opts = {}) {
    this.assets = new AssetRegistry(opts);
    this.briefs = new CreativeBriefEngine(opts);
    this.compliance = new BrandComplianceEngine();
    this.router = new MediaProductionRouter();
    this.approvals = new AssetApprovalEngine(opts);
    this.scorecard = new CreativeScorecard();
  }

  handleMissingAsset({ brand, platform, type, requestId, copyText }) {
    const brief = this.briefs.create({ requestId, brand, platform, goal: 'Replace missing ' + type + ' for ' + brand });
    const route = this.router.route({ type, requestId });
    const compliance = this.compliance.review({ text: copyText, type });
    const asset = this.assets.register({ assetId: makeId('AID'), type, brand, platform, url: null });
    const approval = this.approvals.request(asset.id, 'Auto-created from missing ' + type + ' alert for ' + brand);
    this.briefs.linkAsset(brief.id, asset.id);
    return { brief: { id: brief.id, status: brief.status, lane: route.lane }, asset: { id: asset.id, status: 'draft', compliance: compliance.level }, approval: { id: approval.id, status: approval.status }, compliance, routedTo: route };
  }

  dashboard() {
    const s = this.scorecard.dashboard(this.assets);
    return { ...s, pendingApprovals: this.approvals.pending().length, briefs: this.briefs.all().length };
  }
}

export default AssetCreativeOS;
