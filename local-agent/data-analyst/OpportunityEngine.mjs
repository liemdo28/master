/**
 * OpportunityEngine — generates revenue opportunity recommendations
 * based on real analytics data.
 */

/**
 * Generate recommendations from analytics results.
 * Input: analytics object with revenueByDay, revenueByHour, itemPerformance, etc.
 */
export function generateOpportunities(analytics, meta = {}) {
  const opportunities = [];
  const store = meta.store || '';

  // ── Day-based opportunities ──────────────────────────────────────────────
  if (analytics.byDay && analytics.byDay.data?.length >= 3) {
    const { bottom_day, top_day, avg_daily } = analytics.byDay;

    if (bottom_day && avg_daily > 0) {
      const shortfall = avg_daily - bottom_day.total;
      const pct = Math.round((shortfall / avg_daily) * 100);
      if (pct > 20) {
        opportunities.push({
          type: 'low_day',
          priority: 'high',
          title: `Tăng doanh thu ngày ${bottom_day.weekday} (yếu nhất)`,
          insight: `Ngày ${bottom_day.date} (${bottom_day.weekday}) chỉ đạt $${bottom_day.total} — thấp hơn trung bình $${avg_daily} (${pct}% dưới TB)`,
          recommendation: `Cân nhắc: special combo ngày ${bottom_day.weekday}, social media post trước 1 ngày, hoặc happy hour để kéo traffic`,
          potential_gain: Math.round(shortfall),
        });
      }
    }

    if (top_day) {
      opportunities.push({
        type: 'best_day',
        priority: 'info',
        title: `Ngày ${top_day.weekday} là ngày mạnh nhất`,
        insight: `Ngày ${top_day.date} đạt $${top_day.total} — cao nhất trong kỳ`,
        recommendation: `Đảm bảo staffing đầy đủ ngày ${top_day.weekday}. Có thể tăng upsell items vào ngày này.`,
        potential_gain: null,
      });
    }
  }

  // ── Hour-based opportunities ─────────────────────────────────────────────
  if (analytics.byHour && analytics.byHour.data?.length > 0) {
    const { peak_hour, weak_hour } = analytics.byHour;

    if (peak_hour) {
      opportunities.push({
        type: 'peak_hour',
        priority: 'info',
        title: `Giờ cao điểm: ${peak_hour.label}`,
        insight: `Giờ ${peak_hour.label} có doanh thu cao nhất $${peak_hour.total} (${peak_hour.transactions} giao dịch)`,
        recommendation: `Đảm bảo đủ nhân sự và prep food trước ${peak_hour.label}. Không để hết table trống vào giờ này.`,
        potential_gain: null,
      });
    }

    if (weak_hour && peak_hour && weak_hour.hour !== peak_hour.hour) {
      const ratio = peak_hour.total > 0 ? Math.round((weak_hour.total / peak_hour.total) * 100) : 0;
      if (ratio < 30) {
        opportunities.push({
          type: 'weak_hour',
          priority: 'medium',
          title: `Giờ thấp điểm ${weak_hour.label} cần kích thích`,
          insight: `Giờ ${weak_hour.label} chỉ đạt $${weak_hour.total} — ${ratio}% so với peak (${peak_hour.label})`,
          recommendation: `Happy hour ${weak_hour.label}? Lunch special? Đây là cơ hội tăng thêm doanh thu mà không tốn thêm overhead.`,
          potential_gain: Math.round(peak_hour.total * 0.3 - weak_hour.total),
        });
      }
    }
  }

  // ── Item-based opportunities ─────────────────────────────────────────────
  if (analytics.items && analytics.items.top?.length > 0 && analytics.items.slow?.length > 0) {
    const top3 = analytics.items.top.slice(0, 3);
    const slow3 = analytics.items.slow.slice(0, 3);

    opportunities.push({
      type: 'top_items_promote',
      priority: 'high',
      title: `Promote top-sellers để tăng revenue`,
      insight: `Top items: ${top3.map(i => `"${i.name}" ($${i.revenue})`).join(', ')}`,
      recommendation: `Feature top sellers trên menu, social media, và server recommendations. Xem xét combo deals với top items.`,
      potential_gain: Math.round(top3[0]?.revenue * 0.1 || 0),
    });

    opportunities.push({
      type: 'slow_items_review',
      priority: 'medium',
      title: `Review slow-selling items`,
      insight: `Slow items: ${slow3.map(i => `"${i.name}" ($${i.revenue})`).join(', ')}`,
      recommendation: `Cân nhắc: (1) bỏ items này khỏi menu, (2) thêm vào combo để push, hoặc (3) thay đổi pricing/presentation.`,
      potential_gain: null,
    });
  }

  // ── Weekday opportunities ────────────────────────────────────────────────
  if (analytics.byWeekday && analytics.byWeekday.data?.length >= 3) {
    const { best_day, worst_day } = analytics.byWeekday;

    if (worst_day && best_day && worst_day.avg_per_day < best_day.avg_per_day * 0.5) {
      opportunities.push({
        type: 'weekday_gap',
        priority: 'high',
        title: `${worst_day.weekday} cần strategy đặc biệt`,
        insight: `${worst_day.weekday} trung bình $${worst_day.avg_per_day}/ngày vs ${best_day.weekday} $${best_day.avg_per_day}/ngày`,
        recommendation: `Thêm event, promotion, hoặc social post đặc biệt vào ${worst_day.weekday} để kéo traffic.`,
        potential_gain: Math.round(best_day.avg_per_day * 0.4 - worst_day.avg_per_day),
      });
    }
  }

  // ── WoW trend ──────────────────────────────────────────────────────────
  if (analytics.wow && analytics.wow.trend !== null) {
    const trend = analytics.wow.trend;
    if (trend < -5) {
      opportunities.push({
        type: 'declining_trend',
        priority: 'urgent',
        title: `Doanh thu đang giảm ${Math.abs(trend)}% tuần này`,
        insight: `Week-over-week: ${trend}%`,
        recommendation: `Cần hành động ngay: kiểm tra staffing, reviews, promotions, và competitor activity. Tăng marketing effort ngay tuần tới.`,
        potential_gain: null,
      });
    } else if (trend > 5) {
      opportunities.push({
        type: 'growing_trend',
        priority: 'info',
        title: `Doanh thu tăng ${trend}% tuần này — keep momentum`,
        insight: `Week-over-week: +${trend}%`,
        recommendation: `Giữ nguyên strategy đang hoạt động tốt. Có thể nhân đôi effort trên kênh đang mang lại traffic.`,
        potential_gain: null,
      });
    }
  }

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, info: 3 };
  opportunities.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

  return {
    opportunities,
    count: opportunities.length,
    top_priority: opportunities[0] || null,
    estimated_total_gain: opportunities
      .filter(o => o.potential_gain)
      .reduce((s, o) => s + o.potential_gain, 0),
  };
}

/**
 * Generate weekly report summary text (Vietnamese)
 */
export function generateReportText(analytics, meta = {}) {
  const s = analytics.summary;
  const store = meta.store || 'Cửa hàng';
  const period = s?.date_range ? `${s.date_range.from} → ${s.date_range.to}` : 'kỳ này';

  const lines = [
    `## 📊 BÁO CÁO DOANH THU — ${store.toUpperCase()}`,
    `**Kỳ:** ${period}`,
    `**Nguồn:** ${meta.source || 'file upload'}`,
    `**Rows:** ${s?.total_rows || 0} | **Confidence:** ${meta.confidence || 0}%`,
    '',
    `### 💰 Tổng Quan`,
    `- Tổng doanh thu: **$${s?.total_revenue || 0}**`,
    `- Trung bình/ngày: $${s?.avg_daily_revenue || 0}`,
    `- Trung bình/đơn: $${s?.avg_order_value || 0}`,
    `- Số đơn: ${s?.unique_orders || s?.total_rows || 0}`,
    '',
  ];

  if (analytics.byDay?.top_day) {
    lines.push(`### 📅 Ngày Cao Nhất`);
    lines.push(`- ${analytics.byDay.top_day.date} (${analytics.byDay.top_day.weekday}): $${analytics.byDay.top_day.total}`);
    lines.push('');
  }

  if (analytics.byHour?.peak_hour) {
    lines.push(`### ⏰ Giờ Bán Tốt Nhất`);
    lines.push(`- ${analytics.byHour.peak_hour.label}: $${analytics.byHour.peak_hour.total} (${analytics.byHour.peak_hour.transactions} giao dịch)`);
    lines.push('');
  }

  if (analytics.items?.top?.length > 0) {
    lines.push(`### 🍣 Top 5 Món Bán Chạy`);
    analytics.items.top.slice(0, 5).forEach((item, i) => {
      lines.push(`${i + 1}. **${item.name}** — $${item.revenue} (${item.quantity} phần, ${item.orders} đơn)`);
    });
    lines.push('');
  }

  if (analytics.items?.slow?.length > 0) {
    lines.push(`### 🐌 Món Bán Chậm`);
    analytics.items.slow.slice(0, 5).forEach((item, i) => {
      lines.push(`${i + 1}. ${item.name} — $${item.revenue}`);
    });
    lines.push('');
  }

  if (analytics.opportunities?.opportunities?.length > 0) {
    lines.push(`### 💡 Cơ Hội Tăng Doanh Thu`);
    analytics.opportunities.opportunities.slice(0, 3).forEach(opp => {
      lines.push(`- [${opp.priority.toUpperCase()}] **${opp.title}**`);
      lines.push(`  ${opp.recommendation}`);
    });
  }

  return lines.join('\n');
}
