/**
 * Slack Connector — Sprint 2.1
 * Reads Slack messages, channels, and mentions via Web API.
 *
 * Setup: set SLACK_BOT_TOKEN and SLACK_TEAM_ID in .env
 * Token format: xoxb-...
 * Docs: https://api.slack.com/docs/oauth
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const CACHE_PATH = path.join(GLOBAL_DIR, 'visibility', 'slack');
const CACHE_FILE = path.join(CACHE_PATH, 'data.json');

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
  num_members: number;
  topic: string;
  created: number;
}

export interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  channel: string;
  thread_ts?: string;
}

export interface SlackData {
  status: string;
  team?: string;
  channels: SlackChannel[];
  recent_messages: SlackMessage[];
  unread_count?: number;
  fetched_at: string;
}

function isConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_TEAM_ID);
}

function getStubResult(): SlackData {
  return {
    status: 'not_configured',
    channels: [],
    recent_messages: [],
    fetched_at: new Date().toISOString(),
  };
}

export function getCachedSlack(): SlackData | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as SlackData;
  } catch {
    return null;
  }
}

export async function syncSlack(): Promise<SlackData> {
  if (!isConfigured()) {
    const stub = getStubResult();
    _writeCache(stub);
    return stub;
  }

  const token = process.env.SLACK_BOT_TOKEN!;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    // Fetch channels list
    const channelsRes = await fetch('https://slack.com/api/conversations.list?limit=50', { headers });
    const channelsData = await channelsRes.json() as { ok: boolean; channels?: SlackChannel[]; error?: string };

    if (!channelsData.ok) {
      const err = `Slack API error: ${channelsData.error}`;
      console.warn(`[Mi] Slack: ${err}`);
      const cached = getCachedSlack();
      if (cached) return cached;
      const stub = getStubResult();
      _writeCache(stub);
      return stub;
    }

    const channels: SlackChannel[] = (channelsData.channels || []).map(c => ({
      id: c.id,
      name: c.name,
      is_channel: c.is_channel,
      is_private: c.is_private,
      num_members: c.num_members,
      topic: c.topic || '',
      created: c.created,
    }));

    // Fetch recent messages from public channels (last 24h)
    const recentMessages: SlackMessage[] = [];
    const publicChannels = channels.filter(c => !c.is_private).slice(0, 5); // top 5 only

    for (const channel of publicChannels) {
      try {
        const histRes = await fetch(
          `https://slack.com/api/conversations.history?channel=${channel.id}&limit=5`,
          { headers }
        );
        const histData = await histRes.json() as { ok: boolean; messages?: any[] };
        if (histData.ok && histData.messages) {
          for (const m of histData.messages.slice(0, 3)) {
            if (!m.subtype && m.text) { // Skip bot messages and empty
              recentMessages.push({
                ts: m.ts,
                user: m.user || 'unknown',
                text: m.text.substring(0, 200),
                channel: channel.name,
                thread_ts: m.thread_ts,
              });
            }
          }
        }
      } catch {
        // Non-fatal: skip this channel
      }
    }

    // Sort by timestamp desc
    recentMessages.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));

    const result: SlackData = {
      status: 'synced',
      channels,
      recent_messages: recentMessages.slice(0, 20),
      fetched_at: new Date().toISOString(),
    };

    _writeCache(result);
    return result;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.warn(`[Mi] Slack sync failed: ${err}`);
    const cached = getCachedSlack();
    if (cached) return cached;
    const stub = getStubResult();
    _writeCache(stub);
    return stub;
  }
}

function _writeCache(data: SlackData) {
  try {
    fs.mkdirSync(CACHE_PATH, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Non-fatal
  }
}

export function getSlackSummaryText(): string {
  const data = getCachedSlack();
  if (!data) return 'Slack: not synced yet';
  if (data.status === 'not_configured') return 'Slack: not configured (set SLACK_BOT_TOKEN + SLACK_TEAM_ID)';
  return `Slack: ${data.channels.length} channels, ${data.recent_messages.length} recent messages`;
}
