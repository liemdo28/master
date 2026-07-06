import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export enum ProjectStatus {
  DRAFT = "draft",
  RECORDING = "recording",
  RENDERING = "rendering",
  DONE = "done",
  ARCHIVED = "archived",
}

export enum StepStatus {
  PENDING = "pending",
  RECORDING = "recording",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum ActionType {
  NAVIGATE = "navigate",
  CLICK = "click",
  FILL = "fill",
  HOVER = "hover",
  SCROLL = "scroll",
  WAIT = "wait",
  SCREENSHOT = "screenshot",
}

export enum CaptureType {
  SCREENSHOT = "screenshot",
  CLIP = "clip",
  THUMBNAIL = "thumbnail",
}

export enum RenderJobStatus {
  PENDING = "pending",
  RENDERING = "rendering",
  DONE = "done",
  FAILED = "failed",
}

export enum SelectorType {
  CSS = "css",
  XPATH = "xpath",
  TESTID = "testid",
  ROLE = "role",
}

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.nativeEnum(ProjectStatus),
  targetUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).nullable(),
});

export const StepSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  orderIndex: z.number(),
  description: z.string(),
  actionType: z.nativeEnum(ActionType),
  selector: z.string().nullable(),
  selectorType: z.nativeEnum(SelectorType).nullable(),
  value: z.string().nullable(),
  delayMs: z.number(),
  status: z.nativeEnum(StepStatus),
  screenshotPath: z.string().nullable(),
  createdAt: z.string(),
});

export const CaptureSchema = z.object({
  id: z.string(),
  stepId: z.string(),
  projectId: z.string(),
  type: z.nativeEnum(CaptureType),
  filePath: z.string(),
  thumbnailPath: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  createdAt: z.string(),
});

export const RenderJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.nativeEnum(RenderJobStatus),
  videoPath: z.string().nullable(),
  thumbnailPath: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const SelectorRegistrySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  selector: z.string(),
  selectorType: z.nativeEnum(SelectorType),
  name: z.string(),
  description: z.string().nullable(),
  priority: z.number(),
  active: z.boolean(),
  createdAt: z.string(),
});

// =============================================================================
// TYPES
// =============================================================================

export type Project = z.infer<typeof ProjectSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Capture = z.infer<typeof CaptureSchema>;
export type RenderJob = z.infer<typeof RenderJobSchema>;
export type SelectorEntry = z.infer<typeof SelectorRegistrySchema>;

// Workflow step for the Playwright runner
export interface WorkflowStep {
  orderIndex: number;
  description: string;
  actionType: ActionType;
  selector?: string;
  selectorType?: SelectorType;
  value?: string;
  delayMs?: number;
}

// Full workflow definition
export interface WorkflowDefinition {
  projectId: string;
  targetUrl: string;
  steps: WorkflowStep[];
  selectors: Record<string, string>;
}

// Render payload sent to Remotion
export interface RenderPayload {
  projectId: string;
  renderJobId: string;
  steps: Array<{
    stepId: string;
    orderIndex: number;
    description: string;
    screenshotPath: string;
    narrationAudioPath?: string;
    delayMs: number;
  }>;
  voiceover?: string;
  musicPath?: string;
  outputPath: string;
}
