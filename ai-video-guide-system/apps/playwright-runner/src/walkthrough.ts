import type { Browser, Page } from "playwright";
import { burnSubtitles } from "@ai-video-guide/media-utils";
import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const STORAGE_BASE = process.env.STORAGE_BASE ?? path.resolve(__dirname, "../../storage");
const TIMEOUT = parseInt(process.env.PLAYWRIGHT_TIMEOUT ?? "120000", 10);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";
const TTS_URL = process.env.TTS_SERVICE_URL ?? "http://localhost:3005";

export interface WalkthroughRequest {
  jobId: string;
  targetUrl: string;
  username: string;
  password: string;
  subtitles: boolean;
  voice: boolean;
  voiceName?: string;
  label?: string;
}

export interface JobStatus {
  id: string;
  status: "queued" | "recording" | "rendering" | "done" | "failed";
  progress: number;
  message: string;
  steps: string[];
  videoPath?: string;
  outputPath?: string;
  error?: string;
  startedAt: string;
}

export const jobs = new Map<string, JobStatus>();

const USER_SELECTORS = [
  'input[name="username"]', 'input[name="user"]', 'input[name="email"]', 'input[type="email"]',
  'input[name="login"]', 'input[name="account"]', 'input[name="userid"]',
  '#username', '#email', '#user',
  'input[autocomplete="username"]', 'input[autocomplete="email"]',
  'input[id*="user" i]', 'input[id*="email" i]',
];
const PASS_SELECTORS = [
  'input[name="password"]', 'input[type="password"]',
  '#password', 'input[autocomplete="current-password"]', 'input[id*="pass" i]',
];
const SUBMIT_SELECTORS = [
  'button[type="submit"]', 'input[type="submit"]',
  'button:has-text("Login")', 'button:has-text("Log in")', 'button:has-text("Sign in")',
  'button:has-text("Đăng nhập")', 'button:has-text("登录")',
  'a:has-text("Login")', 'a:has-text("Sign in")',
];

interface TimelineStep { time: number; text: string; }

async function findFirstVisible(page: Page, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      if ((await loc.count()) > 0 && (await loc.isVisible())) return sel;
    } catch { /* ignore */ }
  }
  for (const sel of selectors) {
    if ((await page.locator(sel).first().count()) > 0) return sel;
  }
  return null;
}

function probeDuration(videoPath: string): number {
  try {
    const out = execSync(
      `${FFPROBE} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { encoding: "utf-8" }
    );
    return parseFloat(out.trim()) || 0;
  } catch { return 0; }
}

function fmtTimecode(s: number): string {
  const ms = Math.floor((s % 1) * 1000);
  const total = Math.floor(s);
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss},${String(ms).padStart(3, "0")}`;
}

function writeSrt(steps: TimelineStep[], totalDuration: number, srtPath: string) {
  let out = "";
  for (let i = 0; i < steps.length; i++) {
    const start = steps[i].time;
    const end = i + 1 < steps.length ? steps[i + 1].time : Math.max(start + 2, totalDuration);
    out += `${i + 1}\n${fmtTimecode(start)} --> ${fmtTimecode(end)}\n${steps[i].text}\n\n`;
  }
  fs.writeFileSync(srtPath, out, "utf-8");
}

async function synthesizeVoice(text: string, audioDir: string, filename: string): Promise<string> {
  const voice = process.env.EDGE_TTS_VOICE ?? "en-US-AriaNeural";
  await axios.post(`${TTS_URL}/synthesize`, { text, filename, voice });
  const outPath = path.join(audioDir, filename);
  return outPath;
}

export async function runWalkthrough(browser: Browser, req: WalkthroughRequest): Promise<void> {
  const jobDir = path.join(STORAGE_BASE, "walkthroughs", req.jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const update = (patch: Partial<JobStatus>) => {
    const cur = jobs.get(req.jobId);
    if (cur) jobs.set(req.jobId, { ...cur, ...patch });
  };
  const addStep = (msg: string) => {
    const cur = jobs.get(req.jobId);
    if (cur) jobs.set(req.jobId, { ...cur, steps: [...cur.steps, msg] });
  };

  const timeline: TimelineStep[] = [];
  const startedAt = Date.now();
  const elapsed = () => (Date.now() - startedAt) / 1000;
  const log = (text: string) => { timeline.push({ time: elapsed(), text }); addStep(text); };

  try {
    update({ status: "recording", progress: 5, message: "Launching browser..." });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: jobDir, size: { width: 1920, height: 1080 } },
    });
    const page = await context.newPage();

    try {
      // 1. Navigate to target
      update({ progress: 10, message: `Opening ${req.targetUrl}` });
      log(`Opening ${req.targetUrl}`);
      await page.goto(req.targetUrl, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
      await page.waitForTimeout(1500);

      // 2. Attempt login
      if (req.username && req.password) {
        update({ progress: 25, message: "Filling login form..." });
        const userSel = await findFirstVisible(page, USER_SELECTORS);
        const passSel = await findFirstVisible(page, PASS_SELECTORS);
        if (userSel && passSel) {
          log("Entering credentials");
          await page.locator(userSel).first().fill(req.username, { timeout: 8000 });
          await page.waitForTimeout(400);
          await page.locator(passSel).first().fill(req.password, { timeout: 8000 });
          await page.waitForTimeout(400);
          const submitSel = await findFirstVisible(page, SUBMIT_SELECTORS);
          log("Submitting login");
          if (submitSel) await page.locator(submitSel).first().click({ timeout: 8000 });
          else await page.keyboard.press("Enter");
          await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => {});
          await page.waitForTimeout(2000);
          log("Logged in — dashboard loaded");
        } else {
          log("No login form detected, continuing as guest");
        }
      }

      // 3. Auto-walk navigation menu
      update({ progress: 50, message: "Exploring the application..." });
      await autoNavigate(page, log);

      // 4. Final scroll on home and pause
      update({ progress: 75, message: "Finalizing recording..." });
      await page.goto(req.targetUrl, { waitUntil: "domcontentloaded", timeout: TIMEOUT }).catch(() => {});
      await page.waitForTimeout(1500);
      log("Walkthrough complete");
    } finally {
      await context.close();
    }

    // 5. Collect recorded video
    update({ status: "rendering", progress: 80, message: "Processing video..." });
    const videos = fs.readdirSync(jobDir).filter((f) => f.endsWith(".webm"));
    if (videos.length === 0) throw new Error("No video recorded");
    const rawWebm = path.join(jobDir, videos.sort().reverse()[0]);

    const baseMp4 = path.join(jobDir, "walkthrough.mp4");
    execSync(`${FFMPEG} -y -i "${rawWebm}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -an "${baseMp4}"`, { stdio: "pipe" });

    let finalMp4 = baseMp4;
    const duration = probeDuration(baseMp4);

    // 6. Burn subtitles
    if (req.subtitles && timeline.length > 0) {
      const srtPath = path.join(jobDir, "captions.srt");
      writeSrt(timeline, duration, srtPath);
      const subbed = path.join(jobDir, "walkthrough-sub.mp4");
      try {
        burnSubtitles(baseMp4, srtPath, subbed);
        finalMp4 = subbed;
      } catch (err) {
        console.warn("[walkthrough] subtitle burn failed:", String(err));
      }
    }

    // 7. Add voiceover via TTS
    if (req.voice && timeline.length > 0) {
      const narration = timeline.map((t, i) => `${i === 0 ? "Welcome to this walkthrough. " : ""}${t.text}`).join(" ");
      const audioDir = path.join(STORAGE_BASE, "audio");
      fs.mkdirSync(audioDir, { recursive: true });
      const audioFile = `walk-${req.jobId}.mp3`;
      try {
        const audioPath = await synthesizeVoice(narration, audioDir, audioFile);
        const voiced = path.join(jobDir, "walkthrough-voiced.mp4");
        const filter = `-filter:a "volume=1.0"`;
        execSync(`${FFMPEG} -y -i "${finalMp4}" -i "${audioPath}" -c:v copy -c:a aac ${filter} -map 0:v:0 -map 1:a:0 -shortest "${voiced}"`, { stdio: "pipe" });
        finalMp4 = voiced;
      } catch (err) {
        console.warn("[walkthrough] voiceover failed:", String(err));
      }
    }

    update({
      status: "done",
      progress: 100,
      message: "Walkthrough ready",
      videoPath: finalMp4,
      outputPath: `/api/walkthrough/file/${req.jobId}`,
    });
    console.log(`[walkthrough] done: ${finalMp4}`);
  } catch (err) {
    console.error("[walkthrough] failed:", err);
    update({ status: "failed", error: String(err), message: "Walkthrough failed" });
  }
}

async function autoNavigate(page: Page, log: (msg: string) => void): Promise<void> {
  const maxPages = 6;
  const seen = new Set<string>([page.url()]);
  const linkSelectors = [
    'nav a', 'aside a', '[role="navigation"] a',
    '.menu a', '.sidebar a', '.nav a', 'header a', 'a.nav-link', 'a.menu-item',
  ];

  for (let collected = 0; collected < maxPages; ) {
    let next: { selector: string; href: string; text: string } | null = null;
    for (const sel of linkSelectors) {
      const count = await page.locator(sel).count();
      for (let i = 0; i < count; i++) {
        const loc = page.locator(sel).nth(i);
        try {
          const hrefAttr = await loc.getAttribute("href");
          const text = ((await loc.innerText()).trim()) || hrefAttr || "";
          if (!hrefAttr || hrefAttr.startsWith("#")) continue;
          const absolute = new URL(hrefAttr, page.url()).toString();
          if (seen.has(absolute) || absolute === page.url()) continue;
          if (!(await loc.isVisible())) continue;
          next = { selector: `${sel} >> nth=${i}`, href: absolute, text };
          break;
        } catch { /* ignore */ }
      }
      if (next) break;
    }
    if (!next) break;

    log(`Visit: ${next.text}`);
    try {
      await page.locator(next.selector).click({ timeout: 8000 });
      seen.add(next.href);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      collected++;
      await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
      await page.waitForTimeout(800);
    } catch (err) {
      console.warn("[walkthrough] nav failed:", String(err));
      break;
    }
  }
}
