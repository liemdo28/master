/**
 * GitHub Connector — Sprint 2.1
 * Reads GitHub Actions workflow runs and repository status via REST API.
 *
 * Setup: set GITHUB_TOKEN and GITHUB_ORG (or GITHUB_REPOS) in .env
 * Token needs: repo:read, workflow:read scopes
 * Token format: ghp_... or gho_...
 * Docs: https://docs.github.com/en/rest
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const CACHE_PATH = path.join(GLOBAL_DIR, 'visibility', 'github');
const CACHE_FILE = path.join(CACHE_PATH, 'data.json');

export interface GitHubRepo {
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  open_issues: number;
  open_prs: number;
  language?: string;
  updated_at: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | 'timed_out' | 'action_required' | null;
  workflow_id: number;
  head_branch: string;
  head_sha: string;
  run_started_at: string;
  updated_at: string;
  html_url: string;
  repo: string;
}

export interface GitHubData {
  status: string;
  repos: GitHubRepo[];
  recent_runs: GitHubWorkflowRun[];
  failed_runs: GitHubWorkflowRun[];
  fetched_at: string;
}

function isConfigured(): boolean {
  return !!(process.env.GITHUB_TOKEN);
}

function getStubResult(): GitHubData {
  return {
    status: 'not_configured',
    repos: [],
    recent_runs: [],
    failed_runs: [],
    fetched_at: new Date().toISOString(),
  };
}

export function getCachedGitHub(): GitHubData | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as GitHubData;
  } catch {
    return null;
  }
}

function _getRepos(): string[] {
  if (process.env.GITHUB_REPOS) {
    return process.env.GITHUB_REPOS.split(',').map(r => r.trim()).filter(Boolean);
  }
  if (process.env.GITHUB_ORG) {
    return [process.env.GITHUB_ORG]; // Will be expanded in sync
  }
  return [];
}

async function _fetchJSON(url: string, token: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export async function syncGitHub(): Promise<GitHubData> {
  if (!isConfigured()) {
    const stub = getStubResult();
    _writeCache(stub);
    return stub;
  }

  const token = process.env.GITHUB_TOKEN!;
  const repos = _getRepos();
  const allRuns: GitHubWorkflowRun[] = [];
  const allRepos: GitHubRepo[] = [];

  try {
    // Step 1: Get repos (from org or explicit list)
    let repoNames: string[] = [];
    if (process.env.GITHUB_ORG && !process.env.GITHUB_REPOS) {
      try {
        const orgData = await _fetchJSON(
          `https://api.github.com/orgs/${process.env.GITHUB_ORG}/repos?per_page=30&sort=updated`,
          token
        ) as any[];
        repoNames = (orgData || []).map((r: any) => r.full_name);
      } catch {
        repoNames = repos;
      }
    } else {
      repoNames = repos;
    }

    if (repoNames.length === 0) {
      // Default: check a few known repos
      repoNames = ['liemdo28/master', 'liemdo28/bakudanramen'];
    }

    // Step 2: Fetch recent workflow runs for each repo (last 10 runs)
    for (const fullName of repoNames.slice(0, 10)) {
      try {
        // Get repo info
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo) continue;

        const [repoData, runsData] = await Promise.allSettled([
          _fetchJSON(`https://api.github.com/repos/${owner}/${repo}`, token),
          _fetchJSON(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`, token),
        ]);

        if (repoData.status === 'fulfilled') {
          const r = repoData.value as any;
          allRepos.push({
            owner,
            name: repo,
            full_name: fullName,
            default_branch: r.default_branch || 'main',
            open_issues: r.open_issues_count || 0,
            open_prs: 0, // computed below if needed
            language: r.language,
            updated_at: r.updated_at,
          });
        }

        if (runsData.status === 'fulfilled') {
          const runs = runsData.value as any;
          const workflowRuns: GitHubWorkflowRun[] = (runs.workflow_runs || []).map((wr: any) => ({
            id: wr.id,
            name: wr.name,
            status: wr.status,
            conclusion: wr.conclusion,
            workflow_id: wr.workflow_id,
            head_branch: wr.head_branch,
            head_sha: wr.head_sha,
            run_started_at: wr.run_started_at,
            updated_at: wr.updated_at,
            html_url: wr.html_url,
            repo: fullName,
          }));
          allRuns.push(...workflowRuns);
        }
      } catch {
        // Non-fatal: skip this repo
      }
    }

    // Sort all runs by updated_at desc
    allRuns.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const failedRuns = allRuns.filter(r => r.status === 'completed' && r.conclusion === 'failure');

    const result: GitHubData = {
      status: 'synced',
      repos: allRepos,
      recent_runs: allRuns.slice(0, 30),
      failed_runs: failedRuns,
      fetched_at: new Date().toISOString(),
    };

    _writeCache(result);
    return result;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.warn(`[Mi] GitHub sync failed: ${err}`);
    const cached = getCachedGitHub();
    if (cached) return cached;
    const stub = getStubResult();
    _writeCache(stub);
    return stub;
  }
}

function _writeCache(data: GitHubData) {
  try {
    fs.mkdirSync(CACHE_PATH, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Non-fatal
  }
}

export function getGitHubSummaryText(): string {
  const data = getCachedGitHub();
  if (!data) return 'GitHub: not synced yet';
  if (data.status === 'not_configured') return 'GitHub: not configured (set GITHUB_TOKEN)';
  const failed = data.failed_runs.length;
  return `GitHub: ${data.repos.length} repos, ${data.recent_runs.length} recent runs${failed > 0 ? `, ⚠ ${failed} failed` : ''}`;
}
