export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'MISSING' | 'AMBIGUOUS' | 'NEEDS_REMAP';
export type MapStatus = 'FRESH' | 'STALE' | 'PARTIAL' | 'FAILED' | 'NOT_GENERATED';
export type ContextPolicy = 'MAP_ONLY' | 'MAP_PLUS_TARGETED_READ' | 'TARGETED_READ_REQUIRED' | 'REMAP_REQUIRED';

export interface ProjectRecord {
  id: string;
  displayName: string;
  canonicalRoot: string;
  gitRoot: string | null;
  repositoryUrl: string | null;
  defaultBranch: string | null;
  owner: string | null;
  businessPurpose: string | null;
  runtimeHints: string[];
  packageManagers: string[];
  frameworks: string[];
  testCommands: string[];
  buildCommands: string[];
  validationProfile: ValidationProfile | null;
  deploymentNotes: string | null;
  runtimeProcesses: ProjectRuntimeProcess[];
  importantPaths: Record<string, string>;
  status: ProjectStatus;
  mapStatus: MapStatus;
  mapVersion: string | null;
  mapGeneratedAt: string | null;
  mapSourceSha: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationProfile {
  language: string;
  framework: string | null;
  installCommands: string[];
  buildCommands: string[];
  testCommands: string[];
  lintCommands: string[];
  artifactPaths: string[];
  generatedOutputPaths: string[];
  cleanupPolicy: 'none' | 'remove-generated' | 'restore-generated';
  successCriteria: string[];
}

export interface ProjectRuntimeProcess {
  name: string;
  cwd: string | null;
  script: string | null;
  status: string | null;
}

export interface RegisterProjectInput {
  id?: string;
  displayName: string;
  canonicalRoot: string;
  repositoryUrl?: string | null;
  defaultBranch?: string | null;
  owner?: string | null;
  businessPurpose?: string | null;
  runtimeHints?: string[];
  testCommands?: string[];
  buildCommands?: string[];
  validationProfile?: ValidationProfile | null;
  deploymentNotes?: string | null;
  importantPaths?: Record<string, string>;
}

export interface ProjectMapRecord {
  id: number;
  projectId: string;
  mapVersion: string;
  sourceSha: string | null;
  status: MapStatus;
  summary: string;
  modulesJson: string;
  routesJson: string;
  commandsJson: string;
  risksJson: string;
  generatedAt: string;
}

export interface ProjectMap {
  projectId: string;
  mapVersion: string;
  sourceSha: string | null;
  status: MapStatus;
  summary: string;
  modules: ProjectMapModule[];
  routes: string[];
  commands: string[];
  risks: string[];
  generatedAt: string;
}

export interface ProjectMapModule {
  name: string;
  purpose: string;
  paths: string[];
  signals: string[];
}

export interface ResumeContext {
  id: string;
  projectId: string;
  taskId: string | null;
  summary: string;
  openItems: string[];
  lastKnownStatus: string | null;
  updatedAt: string;
}

export interface ContextPack {
  id: string;
  projectId: string;
  mapVersion: string | null;
  sourceSha: string | null;
  mapStatus: MapStatus;
  policy: ContextPolicy;
  summary: string;
  moduleSummaries: string[];
  includedPaths: string[];
  excludedPaths: string[];
  relevanceHints: string[];
  resumeContextId: string | null;
  createdAt: string;
}

export interface ValidateCodingTaskInput {
  projectId?: string | null;
  workingDirectory?: string | null;
  mapVersion?: string | null;
  contextPackId?: string | null;
}
