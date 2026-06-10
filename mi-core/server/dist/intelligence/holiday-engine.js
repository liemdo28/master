"use strict";
/**
 * Holiday Engine — Owner timezone (Vietnam ICT/UTC+7) primary.
 * Computes US Federal + local holidays, business impact for restaurants.
 * Store timezones (Chicago CDT, LA PDT) are secondary reference.
 * No API needed — pure computation + static data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHolidaysForDateRange = getHolidaysForDateRange;
exports.getWeekContext = getWeekContext;
exports.getUpcomingHolidays = getUpcomingHolidays;
exports.getHolidayContextString = getHolidayContextString;
// ── Fixed-date holidays ────────────────────────────────────────────────────
const FIXED_HOLIDAYS = [
    {
        month: 1, day: 1, name: "New Year's Day", type: 'federal',
        business_impact: 'high', traffic_effect: 'up',
        marketing_opportunity: 'New Year special menu, "Fresh Start" sushi/ramen combo',
        restaurant_notes: 'People celebrate — group dining up. Open with limited hours.'
    },
    {
        month: 2, day: 14, name: "Valentine's Day", type: 'commercial',
        business_impact: 'high', traffic_effect: 'up',
        marketing_opportunity: 'Couples sushi set for 2, romantic ramen bowl, dessert add-on',
        restaurant_notes: 'Reserve tables early. Post 5-7 days before.'
    },
    {
        month: 3, day: 17, name: "St. Patrick's Day", type: 'cultural',
        business_impact: 'low', traffic_effect: 'mixed',
        marketing_opportunity: 'Fun themed rolls or green drink special',
        restaurant_notes: 'Minor impact on Japanese restaurants. Optional promo.'
    },
    {
        month: 5, day: 5, name: "Cinco de Mayo", type: 'cultural',
        business_impact: 'low', traffic_effect: 'mixed',
        marketing_opportunity: 'Fusion angle — "Japanese-Mexican" limited roll',
        restaurant_notes: 'Stockton has large Hispanic community — some promo value.'
    },
    {
        month: 7, day: 4, name: "Independence Day", type: 'federal',
        business_impact: 'high', traffic_effect: 'mixed',
        marketing_opportunity: 'Family combo deals, patriotic themed rolls',
        restaurant_notes: 'Many people picnic/BBQ at home. Lunch rush may drop. Dinner pickup orders up.'
    },
    {
        month: 10, day: 31, name: "Halloween", type: 'cultural',
        business_impact: 'medium', traffic_effect: 'up',
        marketing_opportunity: 'Themed rolls (black rice, spider roll feature), Halloween special',
        restaurant_notes: 'Good for early dinner before trick-or-treat. Family-friendly promo.'
    },
    {
        month: 11, day: 11, name: "Veterans Day", type: 'federal',
        business_impact: 'medium', traffic_effect: 'up',
        marketing_opportunity: 'Military discount promo — "Thank you for your service"',
        restaurant_notes: 'Stockton has military community. Discount = good PR + traffic.'
    },
    {
        month: 12, day: 24, name: "Christmas Eve", type: 'federal',
        business_impact: 'high', traffic_effect: 'mixed',
        marketing_opportunity: 'Christmas Eve dinner special, family feast combo',
        restaurant_notes: 'Many families dine out. Post 3-5 days before.'
    },
    {
        month: 12, day: 25, name: "Christmas Day", type: 'federal',
        business_impact: 'high', traffic_effect: 'down',
        marketing_opportunity: 'Post on Christmas Eve for next-day specials',
        restaurant_notes: 'Consider closed or limited hours. Chinese/Japanese restaurants often busy.'
    },
    {
        month: 12, day: 31, name: "New Year's Eve", type: 'commercial',
        business_impact: 'high', traffic_effect: 'up',
        marketing_opportunity: 'NYE dinner special, reservation push, countdown combo',
        restaurant_notes: 'One of the biggest dining nights. Open late. Push reservations 1-2 weeks out.'
    },
];
// ── Computed holidays (nth weekday of month) ──────────────────────────────
function getNthWeekday(year, month, weekday, n) {
    const d = new Date(year, month - 1, 1);
    let count = 0;
    while (true) {
        if (d.getDay() === weekday) {
            count++;
            if (count === n)
                return new Date(d);
        }
        d.setDate(d.getDate() + 1);
    }
}
function getLastWeekday(year, month, weekday) {
    const d = new Date(year, month, 0); // last day of month
    while (d.getDay() !== weekday)
        d.setDate(d.getDate() - 1);
    return d;
}
function toYMD(d) {
    return d.toISOString().split('T')[0];
}
function computedHolidays(year) {
    const holidays = [];
    // MLK Day — 3rd Monday of January
    holidays.push({
        name: "Martin Luther King Jr. Day",
        date: toYMD(getNthWeekday(year, 1, 1, 3)),
        type: 'federal', business_impact: 'medium', traffic_effect: 'up',
        marketing_opportunity: 'Community appreciation post, MLK Day family special',
        restaurant_notes: 'School holiday — families out. Good lunch/dinner traffic.'
    });
    // Presidents Day — 3rd Monday of February
    holidays.push({
        name: "Presidents' Day",
        date: toYMD(getNthWeekday(year, 2, 1, 3)),
        type: 'federal', business_impact: 'medium', traffic_effect: 'up',
        marketing_opportunity: 'Long weekend promo — "3-day weekend special"',
        restaurant_notes: 'School holiday week. Families look for lunch spots.'
    });
    // Mother's Day — 2nd Sunday of May
    holidays.push({
        name: "Mother's Day",
        date: toYMD(getNthWeekday(year, 5, 0, 2)),
        type: 'commercial', business_impact: 'high', traffic_effect: 'up',
        marketing_opportunity: 'Mother\'s Day sushi set for mom, free mochi dessert, "Treat Your Mom" campaign',
        restaurant_notes: 'One of the biggest dining days of year. Push 7-10 days before. Full house.'
    });
    // Memorial Day — last Monday of May
    holidays.push({
        name: "Memorial Day",
        date: toYMD(getLastWeekday(year, 5, 1)),
        type: 'federal', business_impact: 'medium', traffic_effect: 'mixed',
        marketing_opportunity: '"Summer Kickoff" promo, long weekend combo',
        restaurant_notes: 'Many BBQ at home. Dinner traffic may be lighter. Push takeout/delivery.'
    });
    // Father's Day — 3rd Sunday of June
    holidays.push({
        name: "Father's Day",
        date: toYMD(getNthWeekday(year, 6, 0, 3)),
        type: 'commercial', business_impact: 'high', traffic_effect: 'up',
        marketing_opportunity: 'Father\'s Day ramen/sushi set, "Dad Combo" deal, group dining push',
        restaurant_notes: 'Major dining day. Post 7 days before. Dine-in push.'
    });
    // Labor Day — 1st Monday of September
    holidays.push({
        name: "Labor Day",
        date: toYMD(getNthWeekday(year, 9, 1, 1)),
        type: 'federal', business_impact: 'medium', traffic_effect: 'mixed',
        marketing_opportunity: '"End of Summer" special, last summer combo',
        restaurant_notes: 'Long weekend — families out. Mix of dine-in and outdoor activity.'
    });
    // Columbus Day — 2nd Monday of October (California does NOT observe, but it is Federal)
    // Skipping — low impact in Stockton
    // Thanksgiving — 4th Thursday of November
    holidays.push({
        name: "Thanksgiving",
        date: toYMD(getNthWeekday(year, 11, 4, 4)),
        type: 'federal', business_impact: 'medium', traffic_effect: 'mixed',
        marketing_opportunity: 'Pre-Thanksgiving dinner, "Alternative Thanksgiving" Japanese feast',
        restaurant_notes: 'Most people cook at home. But non-traditional families may dine out. Consider "Friendsgiving" angle.'
    });
    // Black Friday (day after Thanksgiving)
    const thanksgiving = getNthWeekday(year, 11, 4, 4);
    const blackFriday = new Date(thanksgiving);
    blackFriday.setDate(blackFriday.getDate() + 1);
    holidays.push({
        name: "Black Friday",
        date: toYMD(blackFriday),
        type: 'commercial', business_impact: 'medium', traffic_effect: 'up',
        marketing_opportunity: '"Black Friday Lunch Deal" — quick lunch for shoppers, discount push',
        restaurant_notes: 'Shopping traffic near malls. Quick lunch deals work well.'
    });
    // Lunar New Year (approximate — varies by year)
    const lunarNewYear = {
        2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06',
    };
    if (lunarNewYear[year]) {
        holidays.push({
            name: "Lunar New Year (Tết / Chinese New Year)",
            date: lunarNewYear[year],
            type: 'cultural', business_impact: 'high', traffic_effect: 'up',
            marketing_opportunity: 'Lunar New Year special roll, red envelope promo, "Lucky" combo, Vietnamese/Chinese themed menu',
            restaurant_notes: 'Very high impact — Stockton has large Asian community. Push 1-2 weeks before. Best promo of Q1.'
        });
    }
    return holidays;
}
// ── Main API ──────────────────────────────────────────────────────────────
function getHolidaysForDateRange(startDate, endDate) {
    const year = startDate.getFullYear();
    const years = new Set([year, endDate.getFullYear()]);
    const all = [];
    for (const y of years) {
        // Fixed
        for (const h of FIXED_HOLIDAYS) {
            const date = `${y}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
            all.push({ ...h, date });
        }
        // Computed
        all.push(...computedHolidays(y));
    }
    const startStr = toYMD(startDate);
    const endStr = toYMD(endDate);
    return all.filter(h => h.date >= startStr && h.date <= endStr)
        .sort((a, b) => a.date.localeCompare(b.date));
}
function getWeekContext(referenceDate) {
    const now = referenceDate || new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const next7 = new Date(now);
    next7.setDate(now.getDate() + 7);
    const weekHolidays = getHolidaysForDateRange(monday, sunday);
    const upcoming = getHolidaysForDateRange(now, next7);
    const summary = buildWeekSummary(weekHolidays, upcoming, now);
    const suggestions = buildMarketingSuggestions(upcoming);
    return {
        week_start: toYMD(monday),
        week_end: toYMD(sunday),
        holidays: weekHolidays,
        upcoming_7_days: upcoming,
        has_holiday: weekHolidays.length > 0,
        summary,
        marketing_suggestions: suggestions,
    };
}
function getUpcomingHolidays(days = 30, referenceDate) {
    const now = referenceDate || new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + days);
    return getHolidaysForDateRange(now, end);
}
// ── Summary builders ──────────────────────────────────────────────────────
function buildWeekSummary(weekHolidays, upcoming, now) {
    const lines = [];
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' });
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
    lines.push(`Today: ${dayName}, ${dateStr} — Vietnam (ICT/UTC+7) | Owner timezone PRIMARY`);
    if (weekHolidays.length === 0) {
        lines.push('No Federal or major holidays this week.');
    }
    else {
        lines.push(`This week: ${weekHolidays.map(h => `${h.name} (${h.date})`).join(', ')}`);
    }
    const highImpact = upcoming.filter(h => h.business_impact === 'high');
    if (highImpact.length > 0) {
        lines.push(`Coming up (high impact): ${highImpact.map(h => `${h.name} on ${h.date}`).join(', ')}`);
    }
    return lines.join('\n');
}
function buildMarketingSuggestions(upcoming) {
    if (!upcoming.length)
        return ['No major holidays this week. Good time for evergreen content or SEO posts.'];
    const suggestions = [];
    for (const h of upcoming) {
        if (h.business_impact !== 'low') {
            const daysUntil = Math.ceil((new Date(h.date).getTime() - Date.now()) / 86400000);
            const urgency = daysUntil <= 2 ? '🔴 POST TODAY' : daysUntil <= 5 ? '🟡 Post this week' : '🟢 Plan ahead';
            suggestions.push(`${urgency} — ${h.name} (${daysUntil}d): ${h.marketing_opportunity}`);
        }
    }
    return suggestions.length ? suggestions : ['No urgent holiday posts needed. Focus on regular content schedule.'];
}
// ── Format for AI context ────────────────────────────────────────────────
function getHolidayContextString(referenceDate) {
    const ctx = getWeekContext(referenceDate);
    const upcoming30 = getUpcomingHolidays(30, referenceDate);
    const lines = [
        `[Owner timezone: Vietnam (ICT/UTC+7) — PRIMARY]`,
        `[Store times: Bakudan Ramen (Chicago CDT/CST), Raw Sushi Bar (Los Angeles PDT/PST)]`,
        ctx.summary,
        '',
        'MARKETING SUGGESTIONS:',
        ...ctx.marketing_suggestions,
    ];
    if (upcoming30.length > 0 && upcoming30.some(h => h.business_impact !== 'low')) {
        lines.push('', 'NEXT 30 DAYS (high/medium impact):');
        upcoming30
            .filter(h => h.business_impact !== 'low')
            .slice(0, 5)
            .forEach(h => {
            const d = Math.ceil((new Date(h.date).getTime() - Date.now()) / 86400000);
            lines.push(`• ${h.name} — ${h.date} (${d}d) | Impact: ${h.business_impact} | ${h.restaurant_notes}`);
        });
    }
    return lines.join('\n');
}
