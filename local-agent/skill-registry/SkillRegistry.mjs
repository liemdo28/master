/**
 * Mi Skill Registry — WS7
 *
 * Catalog of skills Mi can delegate to.
 * Skills are functions that handle specific domain tasks:
 * - content writing
 * - SEO analysis
 * - business analysis
 * - project documentation
 * - QA planning
 * - marketing copy
 *
 * Each skill has: name, triggers (regex), handler, approval_required
 */

// ── Skill definitions ──────────────────────────────────────────────────────

/** @typedef {{ name: string, description: string, triggers: RegExp[], handler: (input: SkillInput) => Promise<SkillResult>, approval_required: boolean, category: string }} Skill */

/**
 * @typedef {{ message: string, context?: string, store?: string, language?: string }} SkillInput
 * @typedef {{ output: string, skill_name: string, confidence: number, requires_approval: boolean }} SkillResult
 */

const skills = [
  {
    name: 'content-writer',
    description: 'Tạo social media post, caption, content marketing cho nhà hàng',
    category: 'marketing',
    approval_required: true,
    triggers: [
      /tạo content|create content|viết.*post|write.*post/i,
      /caption|copy.*quảng cáo|marketing.*text/i,
      /social media.*post|đăng.*mạng xã hội/i,
    ],
    async handler(input) {
      const store = input.store || 'the restaurant';
      const isVi = input.language === 'vi' || /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽ]/i.test(input.message);
      const prompt = isVi
        ? `Tạo một bài đăng mạng xã hội cho ${store}. Ngắn gọn, hấp dẫn, có call-to-action. Phong cách: thân thiện, chuyên nghiệp. Dưới 150 từ.`
        : `Write an engaging social media post for ${store}. Short, catchy, with call-to-action. Under 100 words.`;
      return {
        output: `[Content Draft — ${store}]\n${prompt}\n\n⚠️ Requires CEO approval before posting.`,
        skill_name: 'content-writer',
        confidence: 0.9,
        requires_approval: true,
      };
    },
  },

  {
    name: 'seo-analyzer',
    description: 'Phân tích SEO cho website nhà hàng, gợi ý từ khóa và nội dung',
    category: 'marketing',
    approval_required: false,
    triggers: [
      /seo|search engine|từ khóa|keyword/i,
      /google.*rank|xếp hạng.*google/i,
      /meta.*description|title.*tag/i,
    ],
    async handler(input) {
      return {
        output: `[SEO Analysis]\nĐể phân tích SEO đầy đủ, cần:\n• URL trang web cụ thể\n• Thị trường mục tiêu (Stockton CA / San Antonio TX)\n• Từ khóa mục tiêu\n\nGợi ý ngay: "bakudan ramen san antonio", "japanese ramen near me", "best ramen san antonio"\n\nDùng: /mi seo [url] để phân tích chi tiết.`,
        skill_name: 'seo-analyzer',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },

  {
    name: 'project-documenter',
    description: 'Tạo tài liệu dự án, sprint plan, meeting notes, status report',
    category: 'project-management',
    approval_required: false,
    triggers: [
      /tạo.*tài liệu|create.*document|write.*doc/i,
      /sprint.*plan|meeting.*notes|status.*report/i,
      /project.*summary|tóm tắt.*dự án/i,
    ],
    async handler(input) {
      return {
        output: `[Project Documenter]\nSkill này tạo:\n• Sprint planning doc\n• Meeting notes template\n• Status report\n• Technical spec draft\n\nChỉ định: /mi tạo [loại tài liệu] cho dự án [tên]\nVí dụ: /mi tạo meeting notes cho buổi họp với Maria`,
        skill_name: 'project-documenter',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },

  {
    name: 'qa-planner',
    description: 'Tạo test plan, test cases, QA checklist cho code/feature',
    category: 'engineering',
    approval_required: false,
    triggers: [
      /test plan|test case|qa.*plan|kiểm thử/i,
      /qa.*checklist|acceptance.*criteria/i,
      /regression.*test|smoke.*test/i,
    ],
    async handler(input) {
      return {
        output: `[QA Planner]\nSkill này tạo:\n• Test plan cho feature\n• Smoke test checklist\n• Regression test list\n• Acceptance criteria\n\nChỉ định: /mi tạo test plan cho [feature/endpoint]\nVí dụ: /mi tạo test plan cho WhatsApp /mi endpoint`,
        skill_name: 'qa-planner',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },

  {
    name: 'menu-optimizer',
    description: 'Phân tích menu, gợi ý tối ưu giá, mô tả món ăn, upsell suggestions',
    category: 'restaurant-ops',
    approval_required: false,
    triggers: [
      /menu.*optimize|tối ưu.*menu/i,
      /mô tả.*món|menu.*description/i,
      /giá.*menu|menu.*pricing/i,
    ],
    async handler(input) {
      return {
        output: `[Menu Optimizer]\nSkill này hỗ trợ:\n• Viết lại mô tả món ăn (hấp dẫn hơn)\n• Gợi ý giá hợp lý theo thị trường\n• Upsell combos\n• Seasonal specials\n\nChỉ định: /mi tối ưu menu [store] — ví dụ: /mi tối ưu menu bakudan`,
        skill_name: 'menu-optimizer',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },

  {
    name: 'devops-helper',
    description: 'Docker, deployment, CI/CD, server monitoring assistance',
    category: 'engineering',
    approval_required: false,
    triggers: [
      /docker|deploy|ci\/cd|pipeline/i,
      /server.*down|service.*crash|monitoring/i,
      /nginx|pm2|systemd|watchdog/i,
    ],
    async handler(input) {
      return {
        output: `[DevOps Helper]\nSkill này hỗ trợ:\n• Docker compose configs\n• PM2 process management\n• Nginx config review\n• Deployment scripts\n• Health check setup\n\nDùng: /mi [vấn đề cụ thể] để được hỗ trợ chi tiết`,
        skill_name: 'devops-helper',
        confidence: 0.85,
        requires_approval: false,
      };
    },
  },
];

// ── Router ─────────────────────────────────────────────────────────────────

/** Find matching skill for a message */
export function findSkill(message) {
  for (const skill of skills) {
    for (const trigger of skill.triggers) {
      if (trigger.test(message)) {
        return skill;
      }
    }
  }
  return null;
}

/** List all skills */
export function listSkills() {
  return skills.map(s => ({
    name: s.name,
    description: s.description,
    category: s.category,
    approval_required: s.approval_required,
  }));
}

/** Execute a skill */
export async function executeSkill(message, context = {}) {
  const skill = findSkill(message);
  if (!skill) {
    return {
      output: `Không tìm thấy skill phù hợp.\n\nSkills có sẵn:\n${skills.map(s => `• ${s.name}: ${s.description}`).join('\n')}`,
      skill_name: 'none',
      confidence: 0,
      requires_approval: false,
    };
  }

  const input = {
    message,
    store: context.store,
    language: context.language || 'vi',
    context: context.context,
  };

  return skill.handler(input);
}

export default { findSkill, listSkills, executeSkill };
