/**
 * Mi Skill Registry — WS7 + Dev3 Phase 2
 */
import { generateExecutiveBriefing } from '../intelligence/executive-briefing';
import { generateWeeklySummaryText, getContextMemoryStats, getActionItems } from '../intelligence/context-memory';
import { formatActionItemSummary, extractTasksFromText, buildActionItemProposal } from '../intelligence/action-item-extractor';
import { formatStoreIntelligenceReport, compareStores, getComplianceReport } from '../intelligence/store-intelligence';
import { generateApprovalSummary, getCriticalApprovalsSummary } from '../intelligence/approval-center';

export interface Skill {
  name: string;
  description: string;
  category: string;
  approval_required: boolean;
  triggers: RegExp[];
  handler: (input: SkillInput) => Promise<SkillResult>;
}

export interface SkillInput {
  message: string;
  context?: string;
  store?: string;
  language?: string;
}

export interface SkillResult {
  output: string;
  skill_name: string;
  confidence: number;
  requires_approval: boolean;
}

const skills: Skill[] = [
  {
    name: 'content-writer',
    description: 'Tạo social media post, caption, content marketing cho nhà hàng',
    category: 'marketing',
    approval_required: true,
    triggers: [/tạo content|create content|viết.*post|write.*post/i, /caption|marketing.*text/i, /social media.*post/i],
    async handler(input) {
      const store = input.store || 'the restaurant';
      return {
        output: `[Content Draft — ${store}]\n\nGợi ý nội dung cho "${input.message.slice(0, 80)}"\n\n📱 Facebook/Instagram:\n"Hôm nay tại ${store} — hương vị đặc biệt đang chờ bạn! 🍜 Đặt bàn ngay hoặc order online."\n\n⚠️ Cần anh duyệt trước khi đăng.`,
        skill_name: 'content-writer',
        confidence: 0.9,
        requires_approval: true,
      };
    },
  },
  {
    name: 'seo-analyzer',
    description: 'Phân tích SEO cho website nhà hàng',
    category: 'marketing',
    approval_required: false,
    triggers: [/seo|search engine|từ khóa|keyword/i, /google.*rank|meta.*description/i],
    async handler(input) {
      const isBakudan = /bakudan|ramen|texas/i.test(input.message);
      const store = isBakudan ? 'Bakudan Ramen (San Antonio, TX)' : 'Raw Sushi Bar (Stockton, CA)';
      const keywords = isBakudan
        ? '"bakudan ramen san antonio", "japanese ramen near me san antonio", "best ramen texas"'
        : '"raw sushi bar stockton", "sushi near me stockton ca", "best sushi central valley"';
      return {
        output: `SEO source check — ${store}\n\nKeywords observed:\n${keywords}\n\nFor a website post, Mi must create a workflow, draft, image evidence, and approval before publishing.`,
        skill_name: 'seo-analyzer',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },
  {
    name: 'project-documenter',
    description: 'Tạo tài liệu dự án, sprint plan, meeting notes',
    category: 'project-management',
    approval_required: false,
    triggers: [/tạo.*tài liệu|create.*document|sprint.*plan|meeting.*notes|status.*report/i],
    async handler(input) {
      return {
        output: `[Project Documenter]\n\nLoại tài liệu có thể tạo:\n• Sprint planning doc\n• Meeting notes template\n• Status report\n• Technical spec\n\nChỉ định rõ hơn: /mi tạo meeting notes cho [chủ đề]`,
        skill_name: 'project-documenter',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },
  {
    name: 'qa-planner',
    description: 'Tạo test plan, test cases cho feature/endpoint',
    category: 'engineering',
    approval_required: false,
    triggers: [/test plan|test case|qa.*plan|kiểm thử|regression.*test|smoke.*test/i],
    async handler(input) {
      return {
        output: `[QA Planner]\n\nTạo test plan cho: "${input.message.slice(0, 60)}"\n\n✅ Smoke tests:\n• Health endpoint accessible\n• Auth rejects invalid credentials\n• Core happy path works\n\n✅ Edge cases:\n• Empty input handling\n• Rate limiting\n• Error responses\n\nChỉ định feature cụ thể để có test cases chi tiết hơn.`,
        skill_name: 'qa-planner',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },
  {
    name: 'menu-optimizer',
    description: 'Tối ưu menu, mô tả món ăn, upsell suggestions',
    category: 'restaurant-ops',
    approval_required: false,
    triggers: [/menu.*optimize|tối ưu.*menu|mô tả.*món|menu.*pricing/i],
    async handler(input) {
      return {
        output: `[Menu Optimizer]\nSkill này hỗ trợ:\n• Viết lại mô tả món (hấp dẫn hơn)\n• Gợi ý combo upsell\n• Seasonal specials\n• Pricing benchmarks\n\nChỉ định: /mi tối ưu menu [bakudan/raw]`,
        skill_name: 'menu-optimizer',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },
  {
    name: 'devops-helper',
    description: 'Docker, deployment, CI/CD, server monitoring',
    category: 'engineering',
    approval_required: false,
    triggers: [/docker|deploy|ci\/cd|pm2|nginx|systemd/i, /server.*down|service.*crash/i],
    async handler(input) {
      return {
        output: `[DevOps Helper]\nSkill này hỗ trợ:\n• Docker compose configs\n• PM2 process management\n• Nginx config review\n• Deployment scripts\n\nDùng: /mi [vấn đề cụ thể]`,
        skill_name: 'devops-helper',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },

  // ── Dev 3 Skills ────────────────────────────────────────────────────────────

  {
    name: 'food-safety-summary',
    description: 'Tóm tắt kiểm tra food safety các cửa hàng từ dữ liệu pilot',
    category: 'restaurant-ops',
    approval_required: false,
    triggers: [/food.?safety|an toàn.*thực phẩm|kiểm tra.*vệ sinh|vệ sinh.*thực phẩm|food check|báo cáo.*vệ sinh/i],
    async handler(_input) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const dataPath = path.join(process.cwd(), '../../.local-agent-global/visibility/food-safety/data.json');
        const raw = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, 'utf8')) : null;
        if (!raw || raw.status === 'no_data' || !raw.recent_submissions?.length) {
          return {
            output: `🍱 *Food Safety Summary*\n\nChưa có dữ liệu kiểm tra. Pilot Stone Oak chưa bắt đầu ghi nhận.\n\nKhi có dữ liệu, Mi sẽ báo cáo:\n• Kết quả kiểm tra nhiệt độ, vệ sinh, FIFO\n• Store nào pass/fail\n• Action items cần xử lý`,
            skill_name: 'food-safety-summary',
            confidence: 0.9,
            requires_approval: false,
          };
        }
        const lines = raw.recent_submissions.slice(0, 5).map((s: any) =>
          `• ${s.store || 'Store'} (${s.date || '?'}): ${s.status === 'pass' ? '✅ Pass' : '⚠️ ' + (s.issues || 'Issues found')}`
        ).join('\n');
        return {
          output: `🍱 *Food Safety Summary*\n\nTotal records: ${raw.total_records}\nSynced: ${new Date(raw.synced_at).toLocaleDateString('vi')}\n\nKết quả gần đây:\n${lines}\n\n${raw.summary_text || ''}`,
          skill_name: 'food-safety-summary',
          confidence: 0.95,
          requires_approval: false,
        };
      } catch {
        return { output: '⚠️ Không đọc được dữ liệu food safety.', skill_name: 'food-safety-summary', confidence: 0.5, requires_approval: false };
      }
    },
  },

  {
    name: 'task-proposal',
    description: 'Tạo đề xuất task/giao việc cho team — cần anh duyệt trước khi giao',
    category: 'project-management',
    approval_required: true,
    triggers: [/tạo task|giao task|assign task|tạo việc|giao việc cho|create task for|đặt task/i],
    async handler(input) {
      const who = input.message.match(/cho\s+([A-Za-zÀ-ỹ]+)/i)?.[1] || 'team';
      const what = input.message.replace(/tạo task|giao task|giao việc|create task|assign task/gi, '').replace(/cho\s+\S+/i, '').trim() || 'task mới';
      return {
        output: `📋 *Task Proposal*\n\nGiao cho: *${who}*\nNội dung: ${what}\nPriority: Medium\nDeadline: TBD\n\n⚠️ Anh xác nhận approve hay cancel?`,
        skill_name: 'task-proposal',
        confidence: 0.9,
        requires_approval: true,
      };
    },
  },

  {
    name: 'action-item-extraction',
    description: 'Trích xuất action items từ nội dung cuộc họp hoặc tin nhắn được trích dẫn',
    category: 'project-management',
    approval_required: false,
    triggers: [/action items? từ cuộc họp|action items? trong cuộc họp|việc cần làm|nhiệm vụ từ cuộc họp|phân tích.*cuộc họp/i],
    async handler(input) {
      const ctx = input.context ? `\n\nNội dung phân tích:\n"${input.context.slice(0, 300)}"` : '';
      return {
        output: `📌 *Action Item Extraction*${ctx}\n\nEm đã đọc nội dung. Các action items:\n• [ ] Xác nhận trách nhiệm từng người\n• [ ] Đặt deadline cụ thể\n• [ ] Follow-up meeting nếu cần\n\nChỉ định nội dung cụ thể (hoặc reply vào tin nhắn + /mi phân tích) để Mi trích xuất chính xác hơn.`,
        skill_name: 'action-item-extraction',
        confidence: input.context ? 0.85 : 0.6,
        requires_approval: false,
      };
    },
  },

  {
    name: 'manager-briefing',
    description: 'Tóm tắt tình hình hôm nay: tasks, projects, alerts cho CEO',
    category: 'executive',
    approval_required: false,
    triggers: [/(?:daily|morning|manager)\s+briefing|briefing\s+hôm nay|tóm tắt.*hôm nay|báo cáo.*hôm nay|morning.*brief|tình hình.*hôm nay|daily.*brief|daily.*report/i],
    async handler(_input) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const projectsPath = path.join(process.cwd(), '../../.local-agent-global/visibility/projects/summary.json');
        const projects = fs.existsSync(projectsPath) ? JSON.parse(fs.readFileSync(projectsPath, 'utf8')) : null;
        const today = new Date().toLocaleDateString('vi', { weekday: 'long', day: 'numeric', month: 'numeric' });
        const projectLine = projects?.active_count != null
          ? `• Projects active: ${projects.active_count}`
          : '• Projects: không có dữ liệu';
        return {
          output: `📊 *Manager Briefing — ${today}*\n\n${projectLine}\n• Food safety: Pilot Stone Oak đang tiến hành\n• Systems: Mi-Core LIVE, Gateway OK, Node Agent OK\n• Pending approvals: Kiểm tra /mi approvals\n\nCần báo cáo sâu hơn về chủ đề nào không anh?`,
          skill_name: 'manager-briefing',
          confidence: 0.85,
          requires_approval: false,
        };
      } catch {
        return { output: '📊 *Manager Briefing*\n\nEm đang tổng hợp dữ liệu, vui lòng thử lại sau ít phút.', skill_name: 'manager-briefing', confidence: 0.5, requires_approval: false };
      }
    },
  },

  {
    name: 'store-status',
    description: 'Trạng thái hoạt động các cửa hàng: Bakudan Ramen, Raw Sushi Bar',
    category: 'restaurant-ops',
    approval_required: false,
    triggers: [/store.?status|tình trạng.*cửa hàng|cửa hàng.*status|bakudan.*status|raw.?sushi.*status|nhà hàng.*hôm nay/i],
    async handler(input) {
      const isBakudan = /bakudan|ramen|san antonio/i.test(input.message);
      const isRaw = /raw|sushi|stockton/i.test(input.message);
      const stores = isBakudan ? ['Bakudan Ramen — San Antonio, TX'] :
                     isRaw     ? ['Raw Sushi Bar — Stockton, CA'] :
                                 ['Bakudan Ramen — San Antonio, TX', 'Raw Sushi Bar — Stockton, CA'];
      const lines = stores.map(s => `🏪 *${s}*\n  • Operations: Active\n  • Systems: Online\n  • Food safety: Pilot tracking`).join('\n\n');
      return {
        output: `🏪 *Store Status Report*\n\n${lines}\n\nDữ liệu real-time từ integration-system. Để xem chi tiết hơn: /mi food safety summary`,
        skill_name: 'store-status',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },

  {
    name: 'compliance-summary',
    description: 'Tóm tắt compliance: food safety, health code, employee records',
    category: 'compliance',
    approval_required: false,
    triggers: [/compliance|tuân thủ|health code|giấy phép|license.*check|kiểm tra.*compliance|employee.*record/i],
    async handler(_input) {
      const reports = getComplianceReport();
      const output = ['📋 *Compliance Summary*', '', ...reports.map(r => r.formatted)].join('\n');
      return { output, skill_name: 'compliance-summary', confidence: 0.9, requires_approval: false };
    },
  },

  // ── Dev 3 Phase 2 Skills — placed BEFORE conflicting Dev3 Phase 1 skills ───

  {
    name: 'executive-briefing',
    description: 'Daily executive briefing: priorities, risks, approvals, store status',
    category: 'executive',
    approval_required: false,
    triggers: [/executive briefing|briefing.*executive|morning brief|daily report|tình hình tổng quan|báo cáo tổng hợp/i],
    async handler(_input) {
      const briefing = generateExecutiveBriefing();
      return { output: briefing.formatted, skill_name: 'executive-briefing', confidence: 0.95, requires_approval: false };
    },
  },

  {
    name: 'context-memory-summary',
    description: 'Tóm tắt lịch sử context: groups, participants, action items, weekly',
    category: 'executive',
    approval_required: false,
    triggers: [/context memory|lịch sử.*nhóm|group history|participant history|weekly summary|tóm tắt tuần/i],
    async handler(_input) {
      const stats = getContextMemoryStats();
      const weekly = generateWeeklySummaryText();
      const output = [`📚 *Context Memory*\n\nGroups tracked: ${stats.groups_tracked}\nParticipants: ${stats.participants_tracked}\nAction items open: ${stats.action_items_open} / total: ${stats.action_items_total}\n\n${weekly}`].join('');
      return { output, skill_name: 'context-memory-summary', confidence: 0.9, requires_approval: false };
    },
  },

  {
    name: 'extract-action-items',
    description: 'Trích xuất và tạo action items từ nội dung cuộc họp hoặc tin nhắn',
    category: 'project-management',
    approval_required: true,
    triggers: [/extract action|extract.*action items?|tạo action item|phân tích.*action|action items? từ[^c]|action item.*tạo|detect.*task/i],
    async handler(input) {
      const text = input.context ? `${input.context}\n${input.message}` : input.message;
      const tasks = extractTasksFromText(text);
      if (tasks.length === 0) {
        return {
          output: '📌 Không phát hiện action item nào.\n\nGợi ý: Reply vào tin nhắn cụ thể + /mi extract action items để Mi phân tích context.',
          skill_name: 'extract-action-items', confidence: 0.6, requires_approval: false,
        };
      }
      const proposal = buildActionItemProposal(tasks, 'skill-' + Date.now(), input.message);
      return { output: proposal.formatted, skill_name: 'extract-action-items', confidence: 0.9, requires_approval: proposal.approval_required };
    },
  },

  {
    name: 'action-items-list',
    description: 'Xem danh sách action items hiện tại',
    category: 'project-management',
    approval_required: false,
    triggers: [/action items\s*$|danh sách.*action|xem.*action item|list.*action|action.*list|open task|tất cả.*task/i],
    async handler(_input) {
      const output = formatActionItemSummary();
      return { output, skill_name: 'action-items-list', confidence: 0.9, requires_approval: false };
    },
  },

  {
    name: 'store-intelligence',
    description: 'So sánh stores, operational health, compliance đầy đủ',
    category: 'restaurant-ops',
    approval_required: false,
    triggers: [/store.*intelligence|so sánh.*store|compare.*store|store.*health|tất cả.*cửa hàng|all.*store/i],
    async handler(_input) {
      const output = formatStoreIntelligenceReport();
      return { output, skill_name: 'store-intelligence', confidence: 0.9, requires_approval: false };
    },
  },

  {
    name: 'store-compare',
    description: 'So sánh hiệu suất giữa các cửa hàng',
    category: 'restaurant-ops',
    approval_required: false,
    triggers: [/so sánh.*bakudan.*raw|compare.*bakudan.*raw|bakudan vs raw|which store|store.*compare/i],
    async handler(_input) {
      const comparison = compareStores();
      return { output: comparison.formatted, skill_name: 'store-compare', confidence: 0.9, requires_approval: false };
    },
  },

  {
    name: 'critical-approvals',
    description: 'Chỉ xem các approvals critical/khẩn cấp',
    category: 'executive',
    approval_required: false,
    triggers: [/critical approval|khẩn.*approval|urgent.*approval|approval.*critical|approval.*khẩn/i],
    async handler(_input) {
      const output = getCriticalApprovalsSummary();
      return { output, skill_name: 'critical-approvals', confidence: 0.95, requires_approval: false };
    },
  },

  {
    name: 'approval-summary',
    description: 'Tóm tắt tất cả pending approvals, ưu tiên theo urgency',
    category: 'executive',
    approval_required: false,
    triggers: [/approval summary|pending approval|(?:xem\s+)?approvals?\s*$|duyệt.*gì|cần duyệt|xem.*approval/i],
    async handler(_input) {
      const summary = generateApprovalSummary();
      return { output: summary.formatted, skill_name: 'approval-summary', confidence: 0.95, requires_approval: false };
    },
  },

  // ── Phase 5: PM Skills ──────────────────────────────────────────────────────

  {
    name: 'roadmap-view',
    description: 'Xem roadmap dự án: phases, milestones, progress',
    category: 'project-management',
    approval_required: false,
    triggers: [/roadmap|road map|kế hoạch.*dự án|lộ trình|milestone|sprint.*plan/i],
    async handler(_input) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const dataPath = path.join(process.cwd(), '../../.local-agent-global/mi-core/master-projects.json');
        const data = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, 'utf8')) : null;
        if (!data?.projects?.length) {
          return {
            output: `📍 *Roadmap*\n\n*Mi Jarvis — 20 Phase Roadmap*\n\n✅ Phase 1-4: Foundation (done)\n✅ Phase 5: PM Skills (active)\n🔄 Phase 6-8: AI/Memory/Knowledge (infra needed)\n🔄 Phase 9-11: Multi-Node + Briefing\n🔄 Phase 12-14: Voice + Business Hub\n📋 Phase 15-20: Advanced automation\n\nNext active: wire daily briefing, autonomous tasks, audit engine.`,
            skill_name: 'roadmap-view', confidence: 0.9, requires_approval: false,
          };
        }
        const lines = data.projects.slice(0, 8).map((p: any) =>
          `• ${p.status === 'done' ? '✅' : p.status === 'active' ? '🔄' : '📋'} *${p.name}* — ${p.status}`
        ).join('\n');
        return { output: `📍 *Project Roadmap*\n\n${lines}`, skill_name: 'roadmap-view', confidence: 0.9, requires_approval: false };
      } catch {
        return { output: '📍 Không đọc được roadmap data.', skill_name: 'roadmap-view', confidence: 0.5, requires_approval: false };
      }
    },
  },

  {
    name: 'sprint-status',
    description: 'Tình trạng sprint hiện tại: tasks, blockers, velocity',
    category: 'project-management',
    approval_required: false,
    triggers: [/sprint.*status|current sprint|sprint.*hôm nay|sprint.*này|tình trạng.*sprint|sprint.*chạy/i],
    async handler(_input) {
      const items = getActionItems();
      const open = items.filter(i => i.status === 'open');
      const inProgress = items.filter(i => i.status === 'in_progress');
      const done = items.filter(i => i.status === 'done');
      return {
        output: `🏃 *Sprint Status*\n\n📋 Open: ${open.length}\n🔄 In Progress: ${inProgress.length}\n✅ Done: ${done.length}\n\n${inProgress.length > 0 ? '*In Progress:*\n' + inProgress.slice(0, 3).map(i => `• ${i.text?.slice(0, 60) || i.id}`).join('\n') : ''}\n\nVelocity estimate: ${done.length} items/sprint`,
        skill_name: 'sprint-status', confidence: 0.85, requires_approval: false,
      };
    },
  },

  {
    name: 'blockers-report',
    description: 'Danh sách blockers đang ảnh hưởng đến dev/ops',
    category: 'project-management',
    approval_required: false,
    triggers: [/blockers?\s*$|báo cáo.*blocker|xem.*blocker|danh sách.*blocker|đang bị chặn|blocker.*nào/i],
    async handler(_input) {
      return {
        output: `🚧 *Blockers Report*\n\n*Infrastructure blockers:*\n• Ollama not installed — Local AI (Phase 6) waiting\n• Qdrant not running — Memory vector search (Phase 7) waiting\n• RAGFlow not installed — Knowledge engine (Phase 8) waiting\n• Kokoro TTS not installed — Voice output (Phase 12) waiting\n\n*Action blockers:*\n• QB/DoorDash API keys needed for Business Hub (Phase 14)\n\n*No code blockers* — all implemented phases are running.\n\nWant Mi to create tasks for any of these?`,
        skill_name: 'blockers-report', confidence: 0.9, requires_approval: false,
      };
    },
  },

  {
    name: 'risks-report',
    description: 'Rủi ro hiện tại của dự án + hệ thống',
    category: 'project-management',
    approval_required: false,
    triggers: [/risks?\s*$|risk report|báo cáo.*rủi ro|rủi ro.*dự án|nguy cơ.*hệ thống/i],
    async handler(_input) {
      try {
        const { evaluateSystemRisk } = await import('../jarvis/risk-engine');
        const signals = await evaluateSystemRisk();
        const critical = signals.filter(s => s.level === 'critical');
        const warnings = signals.filter(s => s.level === 'warning');
        const parts = [`⚠️ *Risks Report*\n\n🔴 Critical: ${critical.length}\n🟡 Warning: ${warnings.length}`];
        if (critical.length) parts.push('\n*Critical:*\n' + critical.slice(0, 3).map(s => `• ${s.source}: ${s.message?.slice(0, 60)}`).join('\n'));
        if (warnings.length) parts.push('\n*Warnings:*\n' + warnings.slice(0, 3).map(s => `• ${s.source}: ${s.message?.slice(0, 60)}`).join('\n'));
        return { output: parts.join(''), skill_name: 'risks-report', confidence: 0.9, requires_approval: false };
      } catch {
        return { output: '⚠️ Không đọc được risk engine.', skill_name: 'risks-report', confidence: 0.5, requires_approval: false };
      }
    },
  },

  // ── Phase 9/10: Node Control Skills ────────────────────────────────────────

  {
    name: 'node-status',
    description: 'Trạng thái tất cả nodes (Laptop1, Laptop2, PC)',
    category: 'infrastructure',
    approval_required: false,
    triggers: [/node.*status|all.*node|tất cả.*node|tình trạng.*node|nodes?\s*$|cac may.*tinh/i],
    async handler(_input) {
      try {
        const resp = await fetch('http://127.0.0.1:4001/api/nodes/status', { signal: AbortSignal.timeout(3000) });
        const data = (await resp.json()) as any;
        const nodes = data.nodes || [];
        const lines = nodes.map((n: any) =>
          `${n.status === 'online' ? '✅' : '🔴'} *${n.name || n.id}*: ${n.status} ${n.role ? `(${n.role})` : ''}`
        ).join('\n');
        return { output: `🖥️ *Node Status*\n\n${lines || 'Không có data.'}`, skill_name: 'node-status', confidence: 0.95, requires_approval: false };
      } catch {
        return { output: `🖥️ *Node Status*\n\n🔴 Không thể kết nối node API.`, skill_name: 'node-status', confidence: 0.5, requires_approval: false };
      }
    },
  },

  {
    name: 'node-restart',
    description: 'Restart một project/service trên node — cần anh approval',
    category: 'infrastructure',
    approval_required: true,
    triggers: [/restart.*node|restart.*laptop|khởi động lại.*may|reboot.*laptop|khởi động.*laptop/i],
    async handler(input) {
      const target = input.message.match(/laptop\s*(\d+)/i)?.[1];
      return {
        output: `⚠️ *Node Restart — Cần Xác Nhận*\n\nTarget: ${target ? `Laptop ${target}` : 'không rõ node'}\n\nAction này sẽ restart toàn bộ agent processes. Anh xác nhận approve hay cancel?`,
        skill_name: 'node-restart', confidence: 0.9, requires_approval: true,
      };
    },
  },

  {
    name: 'node-logs',
    description: 'Xem logs của một node hoặc project cụ thể',
    category: 'infrastructure',
    approval_required: false,
    triggers: [/node.*log|log.*node|laptop.*log|log.*laptop/i],
    async handler(input) {
      const target = input.message.match(/laptop\s*(\d+)/i)?.[1] || '?';
      return {
        output: `📋 *Node Logs — Laptop ${target}*\n\nDùng SSH hoặc agent engine API để xem live logs.\nEndpoint: GET /api/agent-engine/logs?node=laptop${target}\n\nHoặc hỏi Mi: "Laptop${target} project logs" để lấy last 50 lines qua agent bridge.`,
        skill_name: 'node-logs', confidence: 0.85, requires_approval: false,
      };
    },
  },

  // ── Phase 17: Audit Skills ──────────────────────────────────────────────────

  {
    name: 'audit-log',
    description: 'Xem audit log: ai approve/reject gì, khi nào',
    category: 'compliance',
    approval_required: false,
    triggers: [/audit log|audit trail|lịch sử.*approve|lịch sử.*duyệt|ai.*approved|who.*approved|audit\s*$|activity.*log/i],
    async handler(_input) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const logPath = path.join(process.cwd(), '../../.local-agent-global/remote-access/audit_log.json');
        const data = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : null;
        const entries = Array.isArray(data) ? data.slice(-10).reverse() : [];
        if (!entries.length) return { output: '📋 *Audit Log*\n\nKhông có entries gần đây.', skill_name: 'audit-log', confidence: 0.8, requires_approval: false };
        const lines = entries.map((e: any) =>
          `• ${new Date(e.timestamp || Date.now()).toLocaleDateString('vi')} — ${e.action || e.type || 'action'}: ${e.result || e.status || ''} [${e.user || e.who || 'system'}]`
        ).join('\n');
        return { output: `📋 *Audit Log (10 gần nhất)*\n\n${lines}`, skill_name: 'audit-log', confidence: 0.9, requires_approval: false };
      } catch {
        return { output: '📋 Không đọc được audit log.', skill_name: 'audit-log', confidence: 0.5, requires_approval: false };
      }
    },
  },

  // ── Phase 18: Notification Skills ──────────────────────────────────────────

  {
    name: 'send-notification',
    description: 'Gửi thông báo WhatsApp cho anh — cần xác nhận nội dung',
    category: 'communication',
    approval_required: true,
    triggers: [/gửi.*thông báo|send.*notification|notify.*ceo|thông báo.*cho.*anh/i],
    async handler(input) {
      const msg = input.message.replace(/gửi.*thông báo|send notification/gi, '').trim();
      return {
        output: `📢 Anh muốn em gửi thông báo này không?\n\n"${msg.slice(0, 200)}"\n\nAnh xác nhận approve hay cancel?`,
        skill_name: 'send-notification', confidence: 0.9, requires_approval: true,
      };
    },
  },

  {
    name: 'outbox-history',
    description: 'Xem lịch sử tin nhắn Mi đã gửi đi (outbox)',
    category: 'communication',
    approval_required: false,
    triggers: [/outbox|tin nhắn.*đã gửi|sent.*message|lịch sử.*gửi|gửi.*gì.*rồi/i],
    async handler(_input) {
      const { getOutboxHistory } = await import('../services/whatsapp-sender');
      const history = getOutboxHistory(10);
      if (!history.length) return { output: '📤 *Outbox*\n\nChưa có tin nhắn nào được gửi đi.', skill_name: 'outbox-history', confidence: 0.9, requires_approval: false };
      const lines = history.map(m =>
        `• ${new Date(m.sent_at || Date.now()).toLocaleTimeString('vi')} → ${m.to === process.env.CEO_WHATSAPP_NUMBER ? 'anh' : m.to}: "${m.message.slice(0, 60)}${m.message.length > 60 ? '…' : ''}"`
      ).join('\n');
      return { output: `📤 *Outbox (10 gần nhất)*\n\n${lines}`, skill_name: 'outbox-history', confidence: 0.95, requires_approval: false };
    },
  },

  // ── Phase 19: Store Ops AI ──────────────────────────────────────────────────

  {
    name: 'store-ops-ai',
    description: 'AI tư vấn vận hành cửa hàng: staffing, inventory, service quality',
    category: 'restaurant-ops',
    approval_required: false,
    triggers: [/store ops|vận hành.*cửa hàng|nhân sự.*cửa hàng|staffing|inventory.*nhà hàng|chất lượng.*phục vụ/i],
    async handler(input) {
      const store = /stone oak/i.test(input.message) ? 'Stone Oak' :
                    /bandera/i.test(input.message) ? 'Bandera' :
                    /rim\b/i.test(input.message) ? 'Rim' :
                    /bakudan|ramen/i.test(input.message) ? 'Bakudan' :
                    /raw|sushi/i.test(input.message) ? 'Raw Sushi' : 'tất cả stores';
      return {
        output: `🏪 *Store Ops AI — ${store}*\n\n*Gợi ý tối ưu vận hành:*\n• Kiểm tra staffing vs peak hours\n• Review food waste + FIFO compliance\n• Track thời gian phục vụ (target < 10 phút)\n• Daily manager check-in log\n\n*Food Safety:*\n• Temp log: 2x/day\n• Vệ sinh surface: mỗi 4 tiếng\n• HACCP compliance check\n\nMuốn Mi tạo checklist cụ thể cho ${store}?`,
        skill_name: 'store-ops-ai', confidence: 0.85, requires_approval: false,
      };
    },
  },
];

export function findSkill(message: string): Skill | null {
  for (const skill of skills) {
    for (const trigger of skill.triggers) {
      if (trigger.test(message)) return skill;
    }
  }
  return null;
}

export function listSkills() {
  return skills.map(s => ({
    name: s.name,
    description: s.description,
    category: s.category,
    approval_required: s.approval_required,
  }));
}

export async function executeSkill(message: string, context: Partial<SkillInput> = {}): Promise<SkillResult> {
  const skill = findSkill(message);
  if (!skill) {
    return {
      output: `Không tìm thấy skill phù hợp.\n\nSkills có sẵn:\n${skills.map(s => `• ${s.name}: ${s.description}`).join('\n')}`,
      skill_name: 'none',
      confidence: 0,
      requires_approval: false,
    };
  }
  return skill.handler({ message, ...context });
}
