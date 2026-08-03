/**
 * Resource control for local coding tasks.
 *
 * This machine has 8 GB of VRAM and 32 GB of RAM. A 14B Q4 model already spills
 * out of VRAM on its own, so two concurrent heavy models would page against each
 * other and stall the desktop. Model inference is therefore globally serialised
 * through a single mutex, and admission is refused outright when the host is
 * already under pressure rather than queuing work that will thrash.
 */

import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadedModels } from './llm/ollama-client';

const execFileAsync = promisify(execFile);

export interface ResourceLimits {
  maxActiveCodingTasks: number;
  maxConcurrentModels: number;
  modelLoadTimeoutMs: number;
  inferenceTimeoutMs: number;
  maxContextBytes: number;
  maxOutputBytes: number;
  minFreeDiskGb: number;
  minFreeRamGb: number;
  maxWorktrees: number;
}

export const DEFAULT_LIMITS: ResourceLimits = {
  maxActiveCodingTasks: numberFromEnv('MI_CODING_MAX_ACTIVE_TASKS', 1),
  maxConcurrentModels: numberFromEnv('MI_CODING_MAX_CONCURRENT_MODELS', 1),
  modelLoadTimeoutMs: numberFromEnv('MI_CODING_MODEL_LOAD_TIMEOUT_MS', 180_000),
  inferenceTimeoutMs: numberFromEnv('MI_CODING_INFERENCE_TIMEOUT_MS', 300_000),
  maxContextBytes: numberFromEnv('MI_CODING_MAX_CONTEXT_BYTES', 96 * 1024),
  maxOutputBytes: numberFromEnv('MI_CODING_MAX_OUTPUT_BYTES', 128 * 1024),
  minFreeDiskGb: numberFromEnv('MI_CODING_MIN_FREE_DISK_GB', 10),
  minFreeRamGb: numberFromEnv('MI_CODING_MIN_FREE_RAM_GB', 3),
  maxWorktrees: numberFromEnv('MI_CODING_MAX_WORKTREES', 12),
};

function numberFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface HostSnapshot {
  totalRamGb: number;
  freeRamGb: number;
  cpuCount: number;
  freeDiskGb: number | null;
  loadedModels: Array<{ name: string; vramGb: number }>;
  residentVramGb: number;
}

export async function snapshotHost(diskPath = process.cwd()): Promise<HostSnapshot> {
  const loaded = await loadedModels().catch(() => []);
  return {
    totalRamGb: os.totalmem() / 1e9,
    freeRamGb: os.freemem() / 1e9,
    cpuCount: os.cpus().length,
    freeDiskGb: await freeDiskGb(diskPath),
    loadedModels: loaded.map(m => ({ name: m.name, vramGb: m.vramBytes / 1e9 })),
    residentVramGb: loaded.reduce((sum, m) => sum + m.vramBytes, 0) / 1e9,
  };
}

async function freeDiskGb(target: string): Promise<number | null> {
  const drive = /^([a-z]):/i.exec(target)?.[1];
  if (process.platform !== 'win32' || !drive) {
    try {
      const stat = fs.statfsSync(target);
      return (stat.bavail * stat.bsize) / 1e9;
    } catch {
      return null;
    }
  }
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${drive.toUpperCase()}:'").FreeSpace`,
      ],
      { windowsHide: true, timeout: 20_000 }
    );
    const bytes = Number(String(stdout).trim());
    return Number.isFinite(bytes) ? bytes / 1e9 : null;
  } catch {
    return null;
  }
}

export interface AdmissionDecision {
  admitted: boolean;
  reason?: string;
  snapshot: HostSnapshot;
}

/**
 * Serialises every model call process-wide. Ollama itself would happily load a
 * second model; the point of this gate is that it must not.
 */
class ModelMutex {
  private queue: Array<() => void> = [];
  private held = 0;

  constructor(private readonly slots: number) {}

  get activeCount(): number {
    return this.held;
  }

  get waitingCount(): number {
    return this.queue.length;
  }

  async acquire(): Promise<() => void> {
    if (this.held < this.slots) {
      this.held += 1;
      return () => this.release();
    }
    await new Promise<void>(resolve => this.queue.push(resolve));
    this.held += 1;
    return () => this.release();
  }

  private release(): void {
    this.held = Math.max(0, this.held - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

export class CodingResourceController {
  private readonly mutex: ModelMutex;
  private activeTasks = new Set<string>();

  constructor(readonly limits: ResourceLimits = DEFAULT_LIMITS) {
    this.mutex = new ModelMutex(limits.maxConcurrentModels);
  }

  get active(): string[] {
    return [...this.activeTasks];
  }

  /** Refuses admission when the host cannot safely take another coding task. */
  async admit(taskId: string, options: { diskPath?: string; worktreeCount?: number } = {}): Promise<AdmissionDecision> {
    const snapshot = await snapshotHost(options.diskPath ?? process.cwd());

    if (this.activeTasks.size >= this.limits.maxActiveCodingTasks && !this.activeTasks.has(taskId)) {
      return { admitted: false, reason: `RESOURCE_EXHAUSTED: ${this.activeTasks.size} coding task(s) already active`, snapshot };
    }
    if (snapshot.freeRamGb < this.limits.minFreeRamGb) {
      return {
        admitted: false,
        reason: `RESOURCE_EXHAUSTED: free RAM ${snapshot.freeRamGb.toFixed(1)}GB below ${this.limits.minFreeRamGb}GB`,
        snapshot,
      };
    }
    if (snapshot.freeDiskGb !== null && snapshot.freeDiskGb < this.limits.minFreeDiskGb) {
      return {
        admitted: false,
        reason: `RESOURCE_EXHAUSTED: free disk ${snapshot.freeDiskGb.toFixed(1)}GB below ${this.limits.minFreeDiskGb}GB`,
        snapshot,
      };
    }
    if ((options.worktreeCount ?? 0) > this.limits.maxWorktrees) {
      return {
        admitted: false,
        reason: `RESOURCE_EXHAUSTED: ${options.worktreeCount} worktrees exceeds limit ${this.limits.maxWorktrees}`,
        snapshot,
      };
    }

    this.activeTasks.add(taskId);
    return { admitted: true, snapshot };
  }

  release(taskId: string): void {
    this.activeTasks.delete(taskId);
  }

  /** Runs `fn` holding the global model slot. */
  async withModelSlot<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.mutex.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async health(diskPath = process.cwd()): Promise<{
    limits: ResourceLimits;
    host: HostSnapshot;
    activeTasks: string[];
    modelSlotsInUse: number;
    modelSlotsWaiting: number;
  }> {
    return {
      limits: this.limits,
      host: await snapshotHost(diskPath),
      activeTasks: this.active,
      modelSlotsInUse: this.mutex.activeCount,
      modelSlotsWaiting: this.mutex.waitingCount,
    };
  }
}

/** Process-wide controller; a second instance would defeat the serialisation. */
export const codingResourceController = new CodingResourceController();
