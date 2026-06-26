import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { OssEvidence, OssProject } from './types';
import { getSeedCandidates } from './seed-candidates';

const PROJECTS_DIR = join(process.cwd(), '.mi-harness', 'open-source-governance', 'projects');

function ensureDirs() {
  mkdirSync(PROJECTS_DIR, { recursive: true });
}

function projectPath(projectId: string) {
  return join(PROJECTS_DIR, `${projectId}.json`);
}

export function seedOssRegistry(): OssProject[] {
  ensureDirs();
  const existing = getOssProjects();
  if (existing.length > 0) return existing;
  const seeded = getSeedCandidates();
  seeded.forEach(saveOssProject);
  return seeded;
}

export function saveOssProject(project: OssProject): OssProject {
  ensureDirs();
  project.updatedAt = new Date().toISOString();
  writeFileSync(projectPath(project.project_id), JSON.stringify(project, null, 2));
  return project;
}

export function getOssProject(projectId: string): OssProject | null {
  const fp = projectPath(projectId);
  if (!existsSync(fp)) return null;
  try {
    return JSON.parse(readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

export function getOssProjects(): OssProject[] {
  ensureDirs();
  return readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(PROJECTS_DIR, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function addOssEvidence(projectId: string, evidence: Omit<OssEvidence, 'capturedAt'>): OssProject | null {
  const project = getOssProject(projectId);
  if (!project) return null;
  project.evidence.push({ ...evidence, capturedAt: new Date().toISOString() });
  return saveOssProject(project);
}

export const OSS_REGISTRY_STATUS = 'OSS_REGISTRY_OPERATIONAL';
