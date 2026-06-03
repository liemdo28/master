// ============================================================
// agentctl — CEO CLI for Agent OS
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AgentctlConfig {
  controlUrl: string;   // e.g. "http://localhost:3700"
  workerName: string;    // e.g. "liemdo-PC"
  apiKey?: string;       // optional API key for auth
  json: boolean;         // --json output mode
}

const CONFIG_PATH = path.join(os.homedir(), '.agentctl', 'config.json');

export function loadConfig(): AgentctlConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    // fall through to defaults
  }

  // Defaults — connect to localhost for local dev
  return {
    controlUrl: process.env.AGENTCTL_CONTROL_URL || 'http://localhost:3700',
    workerName: process.env.AGENTCTL_WORKER_NAME || 'liemdo-PC',
    json: false,
  };
}

export function saveConfig(config: Partial<AgentctlConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...config };
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
