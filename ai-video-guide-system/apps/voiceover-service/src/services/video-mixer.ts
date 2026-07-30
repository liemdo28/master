// src/services/video-mixer.ts
// Section 16 & 17 — FFmpeg audio mixing: narration + original + background.
// Loudness normalization, ducking, fade in/out, multi-format export.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { execSync as execAsync } from "child_process";
import { jobOutputsDir } from "../db.js";
import { FFMPEG_PATH } from "../config.js";

export interface MixConfig {
  narrationVolume?: number;   // 0–1 (default 1.0)
  originalVolume?: number;    // 0–1 (default 0.15)
  backgroundVolume?: number;  // 0–1 (default 0.25)
  duckDuringNarration?: boolean;
  fadeIn?: number;            // seconds
  fadeOut?: number;           // seconds
  loudnessTarget?: number;    // LUFS target (default -16)
  stereo?: boolean;
  sampleRate?: number;
}

/**
 * Mix a narration audio (MP3/WAV) with an optional original video.
 * Returns the output MP4 path.
 */
export function mixVideoWithNarration(
  jobId: string,
  narrationAudioPath: string,
  sourceVideoPath: string | null,
  config: MixConfig = {}
): string {
  const {
    narrationVolume = 1.0,
    originalVolume = 0.15,
    backgroundVolume = 0.25,
    fadeIn = 0.5,
    fadeOut = 0.5,
    loudnessTarget = -16,
    stereo = true,
  } = config;

  const outDir = jobOutputsDir(jobId);
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = path.basename(narrationAudioPath, path.extname(narrationAudioPath));
  const outputPath = path.join(outDir, `${baseName}.mp4`);

  const filterParts: string[] = [];

  // Input 0: narration
  filterParts.push(`[0:a]volume=${narrationVolume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=0:d=${fadeOut},loudnorm=I=${loudnessTarget}[narration]`);

  let concat = "[narration]";
  let inputIdx = 1;

  // Input 1: original audio (if available, at low volume)
  if (sourceVideoPath && originalVolume > 0) {
    filterParts.push(`[${inputIdx}:a]volume=${originalVolume}[orig_audio]`);
    concat += `[orig_audio]`;
    inputIdx++;
  }

  // Input 2: background music (if available)
  const bgPath = (config as { backgroundMusicPath?: string }).backgroundMusicPath;
  if (bgPath && backgroundVolume > 0) {
    filterParts.push(`[${inputIdx}:a]volume=${backgroundVolume}[bg_music]`);
    concat += `[bg_music]`;
    inputIdx++;
  }

  // Mix down to stereo or mono
  const mixOut = stereo ? "stereo" : "mono";
  filterParts.push(`${concat}amix=inputs=${concat.split("[").length - 1}:duration=longest[aout]`);

  const filterString = filterParts.join("; ");

  const audioOnlyOut = outputPath.replace(".mp4", "-mixed.wav");
  let cmd: string;

  if (sourceVideoPath) {
    // Replace original audio track with mixed narration
    cmd = `"${FFMPEG_PATH}" -y -i "${sourceVideoPath}" -i "${narrationAudioPath}" ` +
      `-filter_complex "${filterString}" -map 0:v -map "[aout]" ` +
      `-c:v copy -c:a aac -b:a 192k "${outputPath}"`;
  } else {
    // Narration-only video: use a black background
    cmd = `"${FFMPEG_PATH}" -y -f lavfi -i color=black:s=1280x720:d=$(ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${narrationAudioPath}")) ` +
      `-i "${narrationAudioPath}" ` +
      `-filter_complex "${filterString}" -map 0:v -map "[aout]" ` +
      `-c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k "${outputPath}"`;
  }

  execSync(cmd, { stdio: "pipe" });
  return outputPath;
}

/**
 * Concatenate multiple audio files into one (used to join segments).
 */
export function concatAudio(inputPaths: string[], outputPath: string): string {
  const listPath = outputPath + ".concat.txt";
  const listContent = inputPaths.map((p) => `file '${p}'`).join("\n");
  fs.writeFileSync(listPath, listContent, "utf-8");
  try {
    execSync(
      `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`,
      { stdio: "pipe" }
    );
  } finally {
    fs.unlinkSync(listPath);
  }
  return outputPath;
}

/**
 * Convert audio to WAV or MP3.
 */
export function convertAudio(inputPath: string, outputPath: string): string {
  const ext = path.extname(outputPath).toLowerCase();
  const codec = ext === ".wav" ? "-c:a pcm_s16le" : "-c:a libmp3lame -b:a 192k";
  execSync(`"${FFMPEG_PATH}" -y -i "${inputPath}" ${codec} "${outputPath}"`, { stdio: "pipe" });
  return outputPath;
}
