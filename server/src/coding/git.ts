import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function git(cwd: string, args: string[], timeoutMs = 30_000): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return String(stdout).trim();
}

export async function gitMaybe(cwd: string, args: string[], timeoutMs = 30_000): Promise<string | null> {
  try {
    return await git(cwd, args, timeoutMs);
  } catch {
    return null;
  }
}

export function slugifyBranchPart(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return slug || 'coding-task';
}
