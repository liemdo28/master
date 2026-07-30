/**
 * WebsiteActionService.mjs
 * Draft posts, schedule content, update menu/SEO for Raw Sushi Bar & Bakudan Ramen.
 * Publish always requires approval.
 */

import fs from 'fs';
import path from 'path';
import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const SCHEDULE_PATH = path.join(GLOBAL_DIR, 'mi-core', 'content-schedule.json');

const BIZ_CONFIG = {
  'raw-sushi': {
    name: 'Raw Sushi Bar',
    url: 'rawsushibar.com',
    hashtags: ['#RawSushi', '#StocktonFood', '#SushiLovers'],
    best_time: 'Friday 10AM PT',
    tone: 'fresh, clean, upscale',
    seo_keywords: ['sushi stockton', 'best sushi stockton ca'],
  },
  'bakudan': {
    name: 'Bakudan Ramen',
    url: 'bakudanramen.com',
    hashtags: ['#BakudanRamen', '#StocktonRamen', '#RamenLovers'],
    best_time: 'Thursday 11AM PT',
    tone: 'bold, fun, energetic',
    seo_keywords: ['ramen stockton', 'best ramen stockton ca'],
  },
};

function loadSchedule() {
  try { return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf-8')); }
  catch { return []; }
}
function saveSchedule(s) {
  fs.mkdirSync(path.dirname(SCHEDULE_PATH), { recursive: true });
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(s, null, 2));
}

export class WebsiteActionService {
  /** Create a content draft (social post, SEO article, announcement) */
  static createDraft(params) {
    const { business, type = 'social-post', topic, schedule_date, schedule_time } = params;
    const biz = BIZ_CONFIG[business] || BIZ_CONFIG['raw-sushi'];
    const effectiveTopic = topic || 'Weekend Special';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const date = schedule_date || tomorrow.toISOString().split('T')[0];

    const draft = {
      id: `post_${Date.now().toString(36)}`,
      business,
      type,
      topic: effectiveTopic,
      title: `${effectiveTopic} — ${biz.name}`,
      body_vi: `✨ ${effectiveTopic} tại ${biz.name} — Stockton\n\nĐến ngay cuối tuần này để trải nghiệm! Đặt bàn: ${biz.url}\n\n${biz.hashtags.join(' ')}`,
      body_en: `✨ ${effectiveTopic} at ${biz.name} — Stockton\n\nVisit us this weekend! Book: ${biz.url}\n\n${biz.hashtags.join(' ')}`,
      hashtags: biz.hashtags,
      seo_keywords: biz.seo_keywords,
      schedule_date: date,
      schedule_time: schedule_time || biz.best_time,
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    // Save to schedule
    const schedule = loadSchedule();
    schedule.push(draft);
    saveSchedule(schedule);

    // Queue for approval (publish = level 2)
    const action = ApprovalRequiredAction.create({
      type: 'schedule-post',
      target: `${business}/${biz.url}`,
      description: `Schedule ${type}: "${effectiveTopic}" for ${biz.name} on ${date} at ${draft.schedule_time}`,
      payload: draft,
      before_state: 'No post scheduled',
      rollback_plan: 'Reject to cancel. Post will not be published.',
    });
    draft.approval_id = action.id;
    saveSchedule(schedule.map(s => s.id === draft.id ? draft : s));

    return {
      status: 'pending_approval',
      draft,
      action,
      preview: [
        `📝 Content Draft — ${biz.name}`,
        `Topic: ${effectiveTopic}`,
        `Type: ${type}`,
        `Schedule: ${date} at ${draft.schedule_time}`,
        ``,
        `[VI] ${draft.body_vi.slice(0, 120)}...`,
        `[EN] ${draft.body_en.slice(0, 120)}...`,
        `Hashtags: ${draft.hashtags.join(' ')}`,
      ].join('\n'),
      formatted: ApprovalRequiredAction.formatForResponse(action),
    };
  }

  /** Update menu draft — requires approval */
  static updateMenuDraft(business, menuItems) {
    const biz = BIZ_CONFIG[business] || BIZ_CONFIG['raw-sushi'];
    const action = ApprovalRequiredAction.create({
      type: 'update-menu',
      target: `${business}/${biz.url}`,
      description: `Update menu for ${biz.name}: ${menuItems.length} item(s) changed`,
      payload: { business, menuItems },
      before_state: 'Current menu',
      rollback_plan: 'Revert menu to previous version',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Update SEO meta tags — requires approval */
  static updateSEODraft(business, seoData) {
    const biz = BIZ_CONFIG[business] || BIZ_CONFIG['raw-sushi'];
    const action = ApprovalRequiredAction.create({
      type: 'update-seo',
      target: `${business}/${biz.url}`,
      description: `Update SEO for ${biz.name}: ${Object.keys(seoData).join(', ')}`,
      payload: { business, seoData },
      before_state: 'Current SEO settings',
      rollback_plan: 'Revert SEO to previous meta tags',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Get scheduled posts */
  static getScheduled(business) {
    const schedule = loadSchedule();
    return business ? schedule.filter(s => s.business === business) : schedule;
  }
}
