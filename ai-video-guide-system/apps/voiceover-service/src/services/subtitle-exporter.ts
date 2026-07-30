// src/services/subtitle-exporter.ts
// Section 16 — Export SRT subtitles in EN and VI from timed narration segments.
// Also embeds subtitles into MP4 using FFmpeg.
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { Segment } from "@ai-video-guide/voiceover-core";
import { jobSubtitlesDir, jobOutputsDir } from "../db.js";
import { FFMPEG_PATH } from "../config.js";

/**
 * Build an SRT subtitle file from segments with startOffset + duration.
 */
export function buildSRT(segments: Segment[], outputPath: string): void {
  const lines: string[] = [];
  let subtitleIdx = 1;
  for (const seg of segments) {
    if (!seg.outputFile || seg.status !== "qa_passed") continue;
    const start = seg.startOffset ?? 0;
    const dur = seg.duration ?? 0;
    const end = start + dur;
    lines.push(String(subtitleIdx++));
    lines.push(`${formatSRTTime(start)} --> ${formatSRTTime(end)}`);
    lines.push(seg.sourceText);
    lines.push("");
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
}

function formatSRTTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Embed SRT subtitles into MP4 using FFmpeg.
 * Outputs a new MP4 with burned-in subtitles.
 */
export function embedSubtitles(videoPath: string, srtPath: string, outputPath: string): void {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  try {
    execSync(
      `"${FFMPEG_PATH}" -y -i "${videoPath}" -vf subtitles="${srtPath}" -c:a copy "${outputPath}"`,
      { stdio: "pipe" }
    );
  } catch (e) {
    throw new Error(`Failed to embed subtitles: ${e}`);
  }
}

/**
 * Generate all subtitle files for a job.
 */
export function exportSubtitles(
  jobId: string,
  enSegments: Segment[],
  viSegments: Segment[]
): { enSrt: string; viSrt: string } {
  const dir = jobSubtitlesDir(jobId);
  fs.mkdirSync(dir, { recursive: true });
  const enSrt = path.join(dir, `${jobId}-en.srt`);
  const viSrt = path.join(dir, `${jobId}-vi.srt`);
  buildSRT(enSegments, enSrt);
  buildSRT(viSegments, viSrt);
  return { enSrt, viSrt };
}
