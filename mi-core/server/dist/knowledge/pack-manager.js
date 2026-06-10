"use strict";
/**
 * Knowledge Pack Manager — installs reference knowledge packs.
 * Packs are curated .md files covering each domain.
 * Stored in .local-agent-global/knowledge-db/packs/
 * No random web crawl — only structured, cited content.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPacks = listPacks;
exports.installPack = installPack;
exports.installAllPacks = installAllPacks;
exports.uninstallPack = uninstallPack;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const knowledge_db_1 = require("./knowledge-db");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const PACKS_DIR = path_1.default.join(GLOBAL_DIR, 'knowledge-db', 'packs');
// All available packs — seeded on first run
const PACK_DEFINITIONS = [
    { pack_id: 'restaurant-ops', name: 'Restaurant Operations', domain: 'restaurant', description: 'Labor cost, food cost, COGS, inventory, POS, shift management, menu engineering', installed: false },
    { pack_id: 'finance-accounting', name: 'Finance & Accounting', domain: 'finance', description: 'P&L, balance sheet, cash flow, QuickBooks, payroll, tax basics, chart of accounts', installed: false },
    { pack_id: 'marketing-seo', name: 'Marketing & SEO', domain: 'marketing', description: 'Google Search Console, meta tags, schema markup, local SEO, GMB, content strategy', installed: false },
    { pack_id: 'coding-web', name: 'Web Development', domain: 'coding', description: 'Node.js, TypeScript, PHP, React, REST API, authentication, deployment patterns', installed: false },
    { pack_id: 'hr-management', name: 'HR & People', domain: 'hr', description: 'Hiring, onboarding, performance review, PTO, termination, employee handbook basics', installed: false },
    { pack_id: 'mba-strategy', name: 'MBA & Business Strategy', domain: 'mba', description: 'Porter 5 forces, SWOT, OKRs, unit economics, CAC, LTV, growth strategies', installed: false },
    { pack_id: 'personal-productivity', name: 'Personal Productivity', domain: 'productivity', description: 'GTD, time blocking, deep work, weekly review, priority matrix, habits', installed: false },
    { pack_id: 'machine-learning', name: 'Machine Learning', domain: 'ml', description: 'RAG, embeddings, fine-tuning, LLM deployment, Ollama, vector databases', installed: false },
    { pack_id: 'digital-design', name: 'Digital Design', domain: 'design', description: 'UI/UX patterns, color theory, typography, Figma workflow, design systems', installed: false },
    { pack_id: 'audit-compliance', name: 'Audit & Compliance', domain: 'audit', description: 'Internal audit, GAAP basics, expense categorization, payroll compliance', installed: false },
];
// Seeded content for each pack
const PACK_CONTENT = {
    'restaurant-ops': [
        { title: 'Restaurant Labor Cost Guide', content: `# Restaurant Labor Cost Guide\n\n## Industry Standards\n- Labor cost should be 28-35% of revenue\n- FOH (Front of House): servers, hosts, bartenders\n- BOH (Back of House): cooks, dishwashers, prep\n\n## Formula\nLabor Cost % = (Total Labor / Total Revenue) × 100\n\n## Common Issues\n- Overscheduling during slow periods\n- Unauthorized overtime\n- High turnover increasing training costs\n\n## Management Tips\n- Use POS data to predict busy periods\n- Cross-train staff\n- Track daily labor vs. daily sales\n- Set weekly labor budget by role` },
        { title: 'Food Cost & COGS Control', content: `# Food Cost & COGS Control\n\n## Target Food Cost\n- Full-service restaurants: 28-35%\n- Fast casual: 25-30%\n- Fine dining: 28-38%\n\n## Formula\nFood Cost % = (Beginning Inventory + Purchases - Ending Inventory) / Revenue\n\n## Waste Control\n- FIFO (First In, First Out) rotation\n- Daily prep lists to avoid over-prep\n- Yield testing on all proteins\n- Menu engineering to reduce low-margin items\n\n## Bakudan Ramen / Raw Sushi context\n- Track protein cost carefully (salmon, tuna, wagyu)\n- Portion control cards for consistency\n- Supplier price comparison monthly` },
        { title: 'Shift Management Best Practices', content: `# Shift Management\n\n## Schedule Building\n- Post schedule 1 week in advance\n- Account for split shifts, double shifts\n- Track availability preferences\n\n## Opening/Closing Checklists\n- Opening: equipment check, prep completion, mise en place\n- Closing: inventory count, cleaning, cash out\n\n## POS Integration\n- Hourly sales reports to adjust staffing\n- Tip tracking for FOH staff\n- Void/comp tracking for management review` },
    ],
    'finance-accounting': [
        { title: 'P&L Statement Basics', content: `# P&L Statement (Income Statement)\n\n## Structure\n1. Revenue (Gross Sales)\n2. - Cost of Goods Sold (COGS)\n3. = Gross Profit\n4. - Operating Expenses (Labor, Rent, Utilities, Marketing)\n5. = Operating Income (EBITDA)\n6. - Interest, Depreciation, Taxes\n7. = Net Income\n\n## Key Ratios\n- Gross Margin = Gross Profit / Revenue\n- Net Margin = Net Income / Revenue\n- EBITDA Margin = EBITDA / Revenue\n\n## Restaurant Industry Benchmarks\n- Gross margin: 60-70%\n- EBITDA: 10-20% (good), 5-10% (average)` },
        { title: 'QuickBooks Restaurant Setup', content: `# QuickBooks for Restaurant\n\n## Chart of Accounts Setup\n### Income\n- Food Sales\n- Beverage Sales\n- Catering Sales\n- Delivery Sales\n\n### COGS\n- Food Cost\n- Beverage Cost\n- Paper/Packaging\n\n### Expenses\n- Labor (FOH, BOH, Management)\n- Rent\n- Utilities\n- Marketing\n- Supplies\n- Repairs & Maintenance\n\n## Tips\n- Connect POS (Toast, Square) for auto-import\n- Reconcile bank weekly\n- Track cash deposits separately\n- Set up class tracking for multiple locations` },
        { title: 'Cash Flow Management', content: `# Cash Flow Management\n\n## 13-Week Cash Flow Forecast\n- Project inflows: sales, collections\n- Project outflows: payroll, rent, vendors\n- Identify cash gaps 4-8 weeks ahead\n\n## Restaurant-specific\n- Cash business = faster cycle than B2B\n- Pay vendors on terms (Net 30 where possible)\n- Payroll timing (bi-weekly vs weekly)\n- Tax deposits (payroll taxes, sales tax)\n\n## Warning Signs\n- Cash balance decreasing week over week\n- Relying on credit line for payroll\n- Vendor invoices going past due` },
    ],
    'marketing-seo': [
        { title: 'Local SEO for Restaurants', content: `# Local SEO for Restaurants\n\n## Google My Business (GMB)\n- Complete all fields\n- Add photos weekly\n- Respond to all reviews\n- Post updates weekly\n- Enable messaging\n\n## On-Page SEO\n- Title tag: "Bakudan Ramen | Best Ramen in [City]"\n- Meta description with location + key dish\n- H1 must include primary keyword\n- Schema markup: Restaurant, Menu, Review\n\n## Local Citations\n- Yelp, TripAdvisor, OpenTable\n- Consistent NAP (Name, Address, Phone)\n\n## Content Strategy\n- Blog about local food scene\n- Chef profiles\n- Dish stories / ingredient sourcing` },
        { title: 'SEO Technical Checklist', content: `# SEO Technical Checklist\n\n## Core Web Vitals\n- LCP (Largest Contentful Paint): < 2.5s\n- FID (First Input Delay): < 100ms\n- CLS (Cumulative Layout Shift): < 0.1\n\n## Mobile Optimization\n- Mobile-first indexing\n- Touch targets 44x44px minimum\n- No horizontal scroll\n\n## Technical\n- HTTPS required\n- XML sitemap submitted\n- Robots.txt correct\n- Canonical tags on duplicate pages\n- 301 redirects for changed URLs\n\n## Tools\n- Google Search Console\n- Google PageSpeed Insights\n- Screaming Frog for crawl` },
    ],
    'coding-web': [
        { title: 'Node.js + TypeScript Best Practices', content: `# Node.js + TypeScript Best Practices\n\n## Project Structure\n- src/ for source\n- dist/ for compiled output\n- Separate config, routes, services, models\n\n## Error Handling\n- Always use try/catch in async functions\n- Create custom error classes\n- Global error middleware in Express\n\n## Security\n- Helmet.js for HTTP headers\n- Rate limiting on all endpoints\n- Input validation (zod or joi)\n- Never log sensitive data\n\n## Performance\n- Use streaming for large files\n- Cache heavy computations\n- Connection pooling for DB` },
        { title: 'REST API Design Patterns', content: `# REST API Design\n\n## URL Structure\n- GET /api/resources — list\n- GET /api/resources/:id — single\n- POST /api/resources — create\n- PUT/PATCH /api/resources/:id — update\n- DELETE /api/resources/:id — delete\n\n## Response Format\n- Always return JSON\n- Include status code\n- Consistent error format: { error: string, code: string }\n- Pagination: { data, total, page, limit }\n\n## Authentication\n- JWT for stateless auth\n- Refresh token rotation\n- Bearer token in Authorization header` },
    ],
    'mba-strategy': [
        { title: 'Business Strategy Frameworks', content: `# Business Strategy Frameworks\n\n## Porter's 5 Forces\n1. Threat of new entrants\n2. Bargaining power of suppliers\n3. Bargaining power of buyers\n4. Threat of substitutes\n5. Industry rivalry\n\n## SWOT Analysis\n- Strengths: internal advantages\n- Weaknesses: internal disadvantages\n- Opportunities: external favorable factors\n- Threats: external unfavorable factors\n\n## OKRs (Objectives & Key Results)\n- Objective: qualitative goal\n- Key Results: measurable outcomes\n- Quarterly cadence\n- 70% achievement = success\n\n## Unit Economics\n- CAC: cost to acquire 1 customer\n- LTV: lifetime value of customer\n- LTV:CAC ratio should be > 3:1` },
    ],
    'personal-productivity': [
        { title: 'CEO Daily Operating System', content: `# CEO Daily Operating System\n\n## Morning Routine\n1. Review yesterday's outcomes (5 min)\n2. Identify Top 3 priorities for today\n3. Block deep work time (2+ hours)\n4. Review calendar for meetings\n\n## Priority Matrix\n- Urgent + Important → Do now\n- Not urgent + Important → Schedule\n- Urgent + Not important → Delegate\n- Not urgent + Not important → Eliminate\n\n## Weekly Review\n- Review all projects\n- Clear inbox to zero\n- Update task list\n- Plan next week\n\n## Deep Work Principles\n- No meetings before 11am if possible\n- Turn off notifications during focus blocks\n- Single task — no context switching\n- Break every 90 minutes` },
    ],
    'machine-learning': [
        { title: 'Ollama Local LLM Guide', content: `# Ollama — Local LLM Deployment\n\n## Models for Mi Ultimate\n- qwen3:8b — Fast chat, reasoning\n- qwen3:14b — Deep reasoning, complex tasks\n- qwen2.5-coder:7b — Code generation\n- nomic-embed-text — Embeddings for RAG\n\n## Commands\n\`\`\`bash\nollama pull qwen3:8b\nollama list\nollama run qwen3:8b\nollama serve  # Start API on :11434\n\`\`\`\n\n## API\n- POST /api/chat — Chat completion\n- POST /api/generate — Text generation\n- GET /api/tags — List models\n\n## RAG Pattern\n1. Chunk documents (500-1000 tokens)\n2. Embed with nomic-embed-text\n3. Store in vector DB\n4. Query: embed question → find similar chunks → inject into prompt` },
    ],
};
function getInstalledPacks() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(PACKS_DIR, 'installed.json'), 'utf-8'));
    }
    catch {
        return PACK_DEFINITIONS.map(p => ({ ...p, installed: false }));
    }
}
function saveInstalledPacks(packs) {
    fs_1.default.mkdirSync(PACKS_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(PACKS_DIR, 'installed.json'), JSON.stringify(packs, null, 2));
}
function listPacks() {
    const installed = getInstalledPacks();
    const installedIds = new Set(installed.filter(p => p.installed).map(p => p.pack_id));
    return PACK_DEFINITIONS.map(p => ({ ...p, installed: installedIds.has(p.pack_id) }));
}
function installPack(packId) {
    const pack = PACK_DEFINITIONS.find(p => p.pack_id === packId);
    if (!pack)
        return { ok: false, docs_added: 0, message: `Pack "${packId}" not found` };
    const packDir = path_1.default.join(PACKS_DIR, packId);
    fs_1.default.mkdirSync(packDir, { recursive: true });
    const content = PACK_CONTENT[packId] || [];
    let written = 0;
    for (const doc of content) {
        const filename = doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.md';
        fs_1.default.writeFileSync(path_1.default.join(packDir, filename), doc.content, 'utf-8');
        written++;
    }
    // Ingest into knowledge DB
    const result = (0, knowledge_db_1.ingestDirectory)(packDir, `pack-${packId}`);
    // Mark as installed
    const packs = getInstalledPacks();
    const idx = packs.findIndex(p => p.pack_id === packId);
    const updated = { ...pack, installed: true, doc_count: content.length };
    if (idx >= 0)
        packs[idx] = updated;
    else
        packs.push(updated);
    saveInstalledPacks(packs);
    return { ok: true, docs_added: result.ingested, message: `Pack "${pack.name}" installed — ${result.ingested} docs added` };
}
function installAllPacks() {
    const results = {};
    let total = 0;
    for (const pack of PACK_DEFINITIONS) {
        const r = installPack(pack.pack_id);
        results[pack.pack_id] = r.message;
        if (r.ok)
            total += r.docs_added;
    }
    return { total_installed: total, results };
}
function uninstallPack(packId) {
    const packDir = path_1.default.join(PACKS_DIR, packId);
    if (fs_1.default.existsSync(packDir))
        fs_1.default.rmSync(packDir, { recursive: true });
    const packs = getInstalledPacks();
    const idx = packs.findIndex(p => p.pack_id === packId);
    if (idx >= 0)
        packs[idx].installed = false;
    saveInstalledPacks(packs);
    return { ok: true };
}
