import { screenshotsToVideo, mixAudio, generateThumbnail } from "@ai-video-guide/media-utils";
import fs from "fs";
import path from "path";

export interface RenderStep {
  stepId: string;
  orderIndex: number;
  description: string;
  screenshotPath: string;
  narrationAudioPath?: string;
  delayMs: number;
}

export interface RenderOptions {
  renderJobId: string;
  projectId: string;
  steps: RenderStep[];
  outputPath: string;
}

/**
 * Renders a video from a list of steps with screenshots and optional narration.
 * Falls back to media-utils screenshotsToVideo if Remotion is not configured.
 */
export async function renderVideo(options: RenderOptions): Promise<{ videoPath: string }> {
  const { projectId, steps, outputPath } = options;

  const screenshotPaths = steps.map((s) => s.screenshotPath);
  const audioPaths = steps.map((s) => s.narrationAudioPath).filter(Boolean) as string[];

  if (screenshotPaths.length === 0) {
    throw new Error("No screenshots to render");
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Use FFmpeg-based rendering (Remotion integration can be added later)
  const videoPath = screenshotsToVideo(screenshotPaths, audioPaths, outputPath, {
    fps: 30,
    width: 1920,
    height: 1080,
  });

  // Generate thumbnail
  const thumbDir = path.join(path.dirname(outputPath), "thumbnails");
  fs.mkdirSync(thumbDir, { recursive: true });
  const thumbnailPath = path.join(thumbDir, `${projectId}-thumb.png`);
  try {
    generateThumbnail(videoPath, thumbnailPath, "00:01");
  } catch {
    console.warn("[remotion] Thumbnail generation failed, continuing without it");
  }

  // Mix voiceover if available
  if (audioPaths.length > 0) {
    const mixedPath = outputPath.replace(".mp4", "-mixed.mp4");
    mixAudio(videoPath, audioPaths[0], mixedPath, { fadeIn: 0.5, fadeOut: 0.5 });
    fs.renameSync(mixedPath, videoPath);
  }

  console.log(`[remotion] Render complete: ${videoPath}`);
  return { videoPath };
}
