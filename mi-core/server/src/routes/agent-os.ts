/**
 * Company OS Route — exposes the Phase 12–20 agent-engine orchestrators.
 *
 * The Phase 12–20 engines live at repo-root `agent-engine/` as ES modules
 * (portable, JSON-backed, no DB). This server is CommonJS, so we load them with
 * a *real* dynamic import — `new Function('p','return import(p)')` prevents the
 * TypeScript CommonJS transpile from down-levelling `import()` into `require()`
 * (which cannot load ESM).
 *
 * Every phase is instantiated against an isolated temp data dir, so these
 * read-only summary calls never pollute the engines' own persisted state.
 *
 *   Phase 12 Self-Improving Intelligence   /api/company-os/12  -> scorecard
 *   Phase 13 Multi-Agent Workforce         /api/company-os/13  -> scorecard
 *   Phase 14 HITL Autonomy                 /api/company-os/14  -> pending
 *   Phase 15 Autonomous Ops                /api/company-os/15  -> (surface)
 *   Phase 16 Multi-Location OS             /api/company-os/16  -> fleetReport
 *   Phase 17 Franchise OS                  /api/company-os/17  -> crossCompanyReport
 *   Phase 18 Knowledge Graph               /api/company-os/18  -> stats
 *   Phase 19 Executive Simulation          /api/company-os/19  -> (surface)
 *   Phase 20 Autonomous Executive OS       /api/company-os/20  -> dashboard
 *   Phase 53 CFO AI                        /api/company-os/53  -> dashboard
 */

import { Router, Request, Response } from 'express';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

export const agentOsRouter = Router();

// Real dynamic import that survives CommonJS transpilation.
const dynamicImport: (p: string) => Promise<Record<string, unknown>> =
  new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;

// agent-engine sits next to mi-core (repo root). From dist/routes that is ../../../../.
const AGENT_ENGINE_DIR =
  process.env.AGENT_ENGINE_DIR || join(__dirname, '..', '..', '..', '..', 'agent-engine');

interface PhaseDef {
  id: number;
  slug: string;
  name: string;
  dir: string;
  /** zero-arg, side-effect-free read method on the orchestrator, if any */
  summary?: string;
}

const PHASES: PhaseDef[] = [
  { id: 12, slug: '12', name: 'Self-Improving Intelligence', dir: 'phase-12-self-improving-intelligence', summary: 'scorecard' },
  { id: 13, slug: '13', name: 'Multi-Agent Workforce', dir: 'phase-13-multi-agent-workforce', summary: 'scorecard' },
  { id: 14, slug: '14', name: 'HITL Autonomy', dir: 'phase-14-hitl-autonomy', summary: 'pending' },
  { id: 15, slug: '15', name: 'Autonomous Ops', dir: 'phase-15-autonomous-ops' },
  { id: 16, slug: '16', name: 'Multi-Location OS', dir: 'phase-16-multi-location-os', summary: 'fleetReport' },
  { id: 17, slug: '17', name: 'Franchise OS', dir: 'phase-17-franchise-os', summary: 'crossCompanyReport' },
  { id: 18, slug: '18', name: 'Knowledge Graph', dir: 'phase-18-knowledge-graph', summary: 'stats' },
  { id: 19, slug: '19', name: 'Executive Simulation', dir: 'phase-19-executive-simulation' },
  { id: 20, slug: '20', name: 'Autonomous Executive OS', dir: 'phase-20-autonomous-executive-os', summary: 'dashboard' },
  { id: 21, slug: '21', name: 'Customer Experience OS', dir: 'phase-21-customer-experience-os', summary: 'dashboard' },
  { id: 22, slug: '22', name: 'Sales & Revenue Growth OS', dir: 'phase-22-revenue-growth-os', summary: 'dashboard' },
  { id: 23, slug: '23', name: 'Operations Control Tower', dir: 'phase-23-operations-control-tower', summary: 'dashboard' },
  { id: 24, slug: '24', name: 'Procurement & Inventory Intelligence', dir: 'phase-24-procurement-inventory-os', summary: 'dashboard' },
  { id: 25, slug: '25', name: 'HR / Staffing / Labor OS', dir: 'phase-25-hr-labor-os', summary: 'dashboard' },
  { id: 26, slug: '26', name: 'Asset & Creative Production OS', dir: 'phase-26-asset-creative-os', summary: 'dashboard' },
  { id: 27, slug: '27', name: 'Security / Compliance / Risk OS', dir: 'phase-27-security-risk-os', summary: 'dashboard' },
  { id: 28, slug: '28', name: 'Workflow Fabric 2.0', dir: 'phase-28-workflow-fabric-os', summary: 'dashboard' },
  { id: 29, slug: '29', name: 'Data Quality & Governance OS', dir: 'phase-29-data-governance-os', summary: 'dashboard' },
  { id: 30, slug: '30', name: 'CEO Command Center 2.0', dir: 'phase-30-ceo-command-center-os', summary: 'generateBriefing' },
  { id: 31, slug: '31', name: 'Supply Chain OS', dir: 'phase-31-supply-chain-os', summary: 'dashboard' },
  { id: 32, slug: '32', name: 'Legal Compliance OS', dir: 'phase-32-legal-compliance-os', summary: 'dashboard' },
  { id: 33, slug: '33', name: 'Product Innovation OS', dir: 'phase-33-product-innovation-os', summary: 'dashboard' },
  { id: 34, slug: '34', name: 'Fleet Transport OS', dir: 'phase-34-fleet-transport-os', summary: 'dashboard' },
  { id: 35, slug: '35', name: 'Fraud Risk OS', dir: 'phase-35-fraud-risk-os', summary: 'dashboard' },
  { id: 36, slug: '36', name: 'Customer Loyalty OS', dir: 'phase-36-customer-loyalty-os', summary: 'dashboard' },
  { id: 37, slug: '37', name: 'Partner Channel OS', dir: 'phase-37-partner-channel-os', summary: 'dashboard' },
  { id: 38, slug: '38', name: 'Finance Accounting OS', dir: 'phase-38-finance-accounting-os', summary: 'dashboard' },
  { id: 39, slug: '39', name: 'Data Warehouse OS', dir: 'phase-39-data-warehouse-os', summary: 'dashboard' },
  { id: 40, slug: '40', name: 'Autonomous Ops OS', dir: 'phase-40-autonomous-ops-os', summary: 'dashboard' },
  { id: 53, slug: '53', name: 'CFO AI', dir: 'phase-53-cfo-ai', summary: 'dashboard' },
];

const bySlug = new Map(PHASES.map((p) => [p.slug, p]));

interface LoadResult {
  orchestratorName: string;
  api: string[];
  module: Record<string, unknown>;
  instance: Record<string, unknown>;
}

/** Load + instantiate one phase orchestrator in an isolated temp data dir. */
async function loadPhase(p: PhaseDef): Promise<LoadResult> {
  const entry = join(AGENT_ENGINE_DIR, p.dir, 'src', 'orchestrator.js');
  const mod = await dynamicImport(pathToFileURL(entry).href);
  const Orchestrator = (mod.default || Object.values(mod).find((v) => typeof v === 'function')) as
    | (new (opts: { dataDir: string }) => Record<string, unknown>)
    | undefined;
  if (typeof Orchestrator !== 'function') {
    throw new Error(`Phase ${p.id} has no constructable orchestrator export`);
  }
  const dataDir = mkdtempSync(join(tmpdir(), `mi-os-${p.id}-`));
  const instance = new Orchestrator({ dataDir });
  // Walk the prototype chain (orchestrators may extend a base class, e.g. Phase 15).
  const methods = new Set<string>();
  let proto = Object.getPrototypeOf(instance);
  while (proto && proto !== Object.prototype) {
    for (const m of Object.getOwnPropertyNames(proto)) {
      if (m !== 'constructor' && !m.startsWith('_') && typeof (instance as Record<string, unknown>)[m] === 'function') {
        methods.add(m);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return { orchestratorName: Orchestrator.name, api: [...methods], module: mod, instance };
}

// ── Overview: load all 9 phases, report loadability + API surface ─────────────
agentOsRouter.get('/', async (_req: Request, res: Response) => {
  const phases = await Promise.all(
    PHASES.map(async (p) => {
      try {
        const { orchestratorName, api } = await loadPhase(p);
        return { phase: p.id, name: p.name, loaded: true, orchestrator: orchestratorName, api };
      } catch (e: unknown) {
        return { phase: p.id, name: p.name, loaded: false, error: (e as Error).message };
      }
    }),
  );
  res.json({
    track: 'Company OS — Phase 12–20 (agent-engine)',
    agentEngineDir: AGENT_ENGINE_DIR,
    count: phases.length,
    loaded: phases.filter((p) => p.loaded).length,
    phases,
  });
});

// ── Per-phase live summary ────────────────────────────────────────────────────
agentOsRouter.get('/:slug', async (req: Request, res: Response) => {
  const p = bySlug.get(req.params.slug);
  if (!p) {
    return res.status(404).json({ error: `Unknown phase '${req.params.slug}'`, available: PHASES.map((x) => x.slug) });
  }
  try {
    const { orchestratorName, api, instance } = await loadPhase(p);
    let summary: unknown = null;
    if (p.summary && typeof instance[p.summary] === 'function') {
      summary = (instance[p.summary] as (...args: unknown[]) => unknown)();
    }
    return res.json({
      phase: p.id,
      name: p.name,
      loaded: true,
      orchestrator: orchestratorName,
      api,
      summaryMethod: p.summary ?? null,
      summary,
    });
  } catch (e: unknown) {
    return res.status(503).json({ phase: p.id, name: p.name, loaded: false, error: (e as Error).message });
  }
});
