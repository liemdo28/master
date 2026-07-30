/**
 * Shared fixtures for Bakudan Dashboard QA
 * Provides evidence collection, DB validation, and workflow state sharing.
 */
import { test as base, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Evidence {
  screenshots: string[];
  consoleLogs: string[];
  networkLogs: string[];
  videoPath?: string;
}

export interface WorkflowState {
  taskId?: number;
  taskTitle?: string;
  projectId?: number;
}

// ── Shared state file (persists between specs) ─────────────────────────────────

const STATE_FILE = path.join(__dirname, '.auth', 'workflow-state.json');

export function saveWorkflowState(state: WorkflowState): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadWorkflowState(): WorkflowState {
  if (!fs.existsSync(STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

// ── Artifact directory ─────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);
const ARTIFACT_DIR = path.join(__dirname, '..', 'artifacts', today);

export function artifactDir(): string {
  if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  return ARTIFACT_DIR;
}

// ── Evidence collector ─────────────────────────────────────────────────────────

export class EvidenceCollector {
  private consoleLogs: string[] = [];
  private networkLogs: string[] = [];
  private screenshots: string[] = [];
  private page: Page;
  private testName: string;

  constructor(page: Page, testName: string) {
    this.page = page;
    this.testName = testName;

    // Capture console messages
    page.on('console', (msg) => {
      this.consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture network errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        this.networkLogs.push(
          `[${response.status()}] ${response.request().method()} ${response.url()}`
        );
      }
    });

    page.on('requestfailed', (request) => {
      this.networkLogs.push(
        `[FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`
      );
    });
  }

  async screenshotBefore(stepName: string): Promise<string> {
    const filename = `${this.testName}_${stepName}_before.png`;
    const filepath = path.join(artifactDir(), filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    this.screenshots.push(filepath);
    return filepath;
  }

  async screenshotAfter(stepName: string): Promise<string> {
    const filename = `${this.testName}_${stepName}_after.png`;
    const filepath = path.join(artifactDir(), filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    this.screenshots.push(filepath);
    return filepath;
  }

  getEvidence(): Evidence {
    return {
      screenshots: this.screenshots,
      consoleLogs: this.consoleLogs,
      networkLogs: this.networkLogs,
    };
  }

  saveEvidence(): void {
    const evidenceFile = path.join(artifactDir(), `${this.testName}_evidence.json`);
    fs.writeFileSync(evidenceFile, JSON.stringify(this.getEvidence(), null, 2));
  }

  saveConsoleLogs(): void {
    const logFile = path.join(artifactDir(), `${this.testName}_console.log`);
    fs.writeFileSync(logFile, this.consoleLogs.join('\n'));
  }

  saveNetworkLogs(): void {
    const logFile = path.join(artifactDir(), `${this.testName}_network.log`);
    fs.writeFileSync(logFile, this.networkLogs.join('\n'));
  }
}

// ── Ensure Authenticated Helper ────────────────────────────────────────────────

export async function ensureAuthenticated(page: Page): Promise<void> {
  if (page.url().includes('/login')) {
    const email = process.env.TEST_EMAIL || 'liem.dt0208@gmail.com';
    const password = process.env.TEST_PASSWORD || 'admin';
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    // Admin redirects to /overview, staff to /my-tasks — wait for either
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15_000 });
  }
}

// ── Extended test fixture ──────────────────────────────────────────────────────

type QAFixtures = {
  evidence: EvidenceCollector;
};

export const test = base.extend<QAFixtures>({
  evidence: async ({ page }, use, testInfo) => {
    const testName = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const collector = new EvidenceCollector(page, testName);
    await use(collector);
    // Always save evidence after test
    collector.saveEvidence();
    collector.saveConsoleLogs();
    collector.saveNetworkLogs();
  },
});

export { expect };
