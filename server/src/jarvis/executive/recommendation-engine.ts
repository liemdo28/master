/**
 * Phase P6 — Recommendation Engine
 * Mi doesn't just answer — Mi recommends.
 */

interface RecommendationRule {
  triggers: RegExp[];
  suggestions: string[];
  condition?: () => boolean;
}

const RULES: RecommendationRule[] = [
  {
    triggers: [/laptop1/i, /gateway/i],
    suggestions: [
      'Nếu anh muốn, em có thể kiểm tra log gateway chi tiết hơn.',
      'Em đề xuất set up alert nếu latency vượt 500ms.',
    ],
  },
  {
    triggers: [/doordash/i],
    suggestions: [
      'Em đề xuất theo dõi thêm 24 giờ trước khi quyết định.',
      'Nếu lỗi tăng thêm, em sẽ báo anh ngay.',
    ],
  },
  {
    triggers: [/stone oak/i, /bandera/i, /rim/i, /raw sushi/i],
    suggestions: [
      'Em có thể pull revenue report cho store này nếu anh muốn.',
      'Em đề xuất check review status tuần này.',
    ],
  },
  {
    triggers: [/review/i, /google review/i],
    suggestions: [
      'Em có thể chạy review automation ngay bây giờ nếu anh muốn.',
    ],
  },
  {
    triggers: [/mi.core/i, /server/i, /port 4001/i],
    suggestions: [
      'Nếu anh muốn, em có thể kiểm tra memory usage và uptime.',
    ],
  },
  {
    triggers: [/payroll/i, /lương/i],
    suggestions: [
      'Em đề xuất chạy payroll checklist trước ngày 15.',
    ],
  },
  {
    triggers: [/approval/i, /approve/i, /duyệt/i],
    suggestions: [
      'Anh muốn em list tất cả approvals đang chờ không?',
    ],
  },
  {
    triggers: [/risk/i, /rủi ro/i, /nguy hiểm/i],
    suggestions: [
      'Em đề xuất chạy business twin simulation để thấy full risk picture.',
    ],
  },
];

export function getRecommendation(topic: string): string | null {
  const topicLower = topic.toLowerCase();
  for (const rule of RULES) {
    if (rule.triggers.some(r => r.test(topicLower))) {
      const suggestion = rule.suggestions[Math.floor(Math.random() * rule.suggestions.length)];
      return suggestion;
    }
  }
  return null;
}

export function appendRecommendation(reply: string, topic: string): string {
  const rec = getRecommendation(topic);
  if (!rec) return reply;
  return reply + '\n\n' + rec;
}

export function buildProactiveSuggestions(topics: string[]): string[] {
  const suggestions: string[] = [];
  for (const topic of topics) {
    const rec = getRecommendation(topic);
    if (rec && !suggestions.includes(rec)) suggestions.push(rec);
  }
  return suggestions.slice(0, 2);
}
