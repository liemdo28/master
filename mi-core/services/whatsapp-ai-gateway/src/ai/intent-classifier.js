const INTENTS = {
  greeting:    [
    /\b(hello|hi|hey|good morning|good afternoon|good evening)\b/i,
    /\b(hola|buenos dias|buenos días|buen dia|buen día|saludos)\b/i,
    /\b(bonjour|salut|bonsoir)\b/i,
    /(^|\s)(xin chào|chào)(\s|$|[!?.,])/i,
  ],
  hours:       [/\b(open|close|hour|time|when|schedule)\b/i, /(giờ|mở cửa|đóng cửa)/i],
  address:     [/\b(address|location|where|map|direction)\b/i, /(địa chỉ|ở đâu|chỗ nào)/i],
  menu:        [/\b(menu|food|drink|eat|price|ramen)\b/i, /(món|giá|thực đơn)/i],
  rewards:     [/\b(reward|loyalty|points?|discount|voucher|member)\b/i, /(điểm|ưu đãi|thẻ)/i],
  reservation: [/\b(book|reserve|table|reservation|seat)\b/i, /(đặt bàn|đặt chỗ)/i],
  complaint:   [/complain|problem|issue|bad|wrong|unhappy|refund|khiếu nại|tệ|sai/i],
};

function classifyIntent(text) {
  if (!text) return 'unknown';
  for (const [intent, patterns] of Object.entries(INTENTS)) {
    if (patterns.some(p => p.test(text))) return intent;
  }
  return 'unknown';
}

module.exports = { classifyIntent };
