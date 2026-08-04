import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { git, gitMaybe, slugifyBranchPart } from './git';

export interface WorktreePlan {
  projectId: string;
  taskId: string;
  sourceRoot: string;
  baseCommit: string;
  baseBranch: string;
  taskBranch: string;
  worktreePath: string;
}

function defaultWorktreeRoot(projectId: string): string {
  const configured = process.env.MI_CODING_WORKTREE_ROOT;
  return configured ? path.resolve(configured, projectId) : path.resolve(path.join(os.tmpdir(), 'mi-coding-worktrees', projectId));
}

function isInside(target: string, root: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

export async function prepareWorktree(input: {
  projectId: string;
  taskId: string;
  userRequest: string;
  sourceRoot: string;
  baseBranch?: string | null;
  baseCommit?: string | null;
}): Promise<WorktreePlan> {
  const sourceRoot = path.resolve(input.sourceRoot);
  const gitRoot = await git(sourceRoot, ['rev-parse', '--show-toplevel']);
  if (path.resolve(gitRoot) !== sourceRoot) {
    throw new Error(`project git root mismatch: expected ${sourceRoot}, got ${gitRoot}`);
  }
  const baseCommit = input.baseCommit || await git(sourceRoot, ['rev-parse', 'HEAD']);
  const baseBranch = input.baseBranch || await git(sourceRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const shortTask = input.taskId.replace(/^task-/, '').slice(0, 8);
  const taskBranch = `codex/task-${shortTask}-${slugifyBranchPart(input.userRequest)}`;
  const root = defaultWorktreeRoot(input.projectId);
  fs.mkdirSync(root, { recursive: true });
  const realRoot = fs.realpathSync.native(root);
  const worktreePath = path.resolve(realRoot, input.taskId);
  if (!isInside(worktreePath, realRoot)) throw new Error('coding worktree path escaped configured root');
  if (fs.existsSync(worktreePath)) throw new Error(`coding worktree already exists: ${worktreePath}`);

  const existingBranch = await gitMaybe(sourceRoot, ['rev-parse', '--verify', taskBranch]);
  if (existingBranch) throw new Error(`task branch already exists: ${taskBranch}`);
  await git(sourceRoot, ['worktree', 'add', '-b', taskBranch, worktreePath, baseCommit], 60_000);
  return { projectId: input.projectId, taskId: input.taskId, sourceRoot, baseCommit, baseBranch, taskBranch, worktreePath };
}
