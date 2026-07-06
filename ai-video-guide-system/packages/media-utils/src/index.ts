// src/index.ts
import { execSync } from "child_process";
import path from "path";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

export interface MediaInfo {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
  bitrate: number;
  size: number; // bytes
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fps: number;
  format: string;
  sizeBytes: number;
}

/**
 * Probe media file and return metadata using ffprobe.
 */
export function probeMedia(filePath: string): MediaInfo {
  const output = execSync(
    `${FFPROBE} -v quiet -print_format json -show_format -show_streams "${filePath}"`,
    { encoding: "utf-8" }
  );
  const data = JSON.parse(output);
  const video = data.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
  const format = data.format;

  return {
    width: video?.width ?? 1920,
    height: video?.height ?? 1080,
    duration: parseFloat(format?.duration ?? "0"),
    fps: parseFloat(video?.r_frame_rate ?? "30") || 30,
    codec: video?.codec_name ?? "h264",
    bitrate: parseInt(format?.bit_rate ?? "0", 10),
    size: parseInt(format?.size ?? "0", 10),
  };
}

/**
 * Generate thumbnail from video at a specific timestamp.
 */
export function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp: string = "00:00:01"
): void {
  execSync(
    `${FFMPEG} -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`,
    { stdio: "pipe" }
  );
}

/**
 * Concatenate multiple videos into one (with transitions if needed).
 */
export function concatVideos(videoPaths: string[], outputPath: string): void {
  if (videoPaths.length === 0) throw new Error("No videos to concatenate");
  if (videoPaths.length === 1) {
    execSync(`${FFMPEG} -y -i "${videoPaths[0]}" -c copy "${outputPath}"`, { stdio: "pipe" });
    return;
  }

  // Create concat list file
  const listPath = outputPath + ".concat.txt";
  const listContent = videoPaths.map((p) => `file '${p}'`).join("\n");
  require("fs").writeFileSync(listPath, listContent, "utf-8");

  execSync(
    `${FFMPEG} -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`,
    { stdio: "pipe" }
  );

  require("fs").unlinkSync(listPath);
}

/**
 * Overlay subtitle (.srt or .ass) onto video.
 */
export function burnSubtitles(
  videoPath: string,
  subtitlePath: string,
  outputPath: string
): void {
  execSync(
    `${FFMPEG} -y -i "${videoPath}" -vf subtitles="${subtitlePath}" "${outputPath}"`,
    { stdio: "pipe" }
  );
}

/**
 * Add audio track (voiceover/music) to video, with optional fade in/out.
 */
export function mixAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  options: { fadeIn?: number; fadeOut?: number; volume?: number } = {}
): void {
  const fadeIn = options.fadeIn ?? 0;
  const fadeOut = options.fadeOut ?? 0;
  const volume = options.volume ?? 1.0;

  let filter = "";
  if (fadeIn > 0 || fadeOut > 0) {
    filter = `-af "afade=t=in:st=0:d=${fadeIn},afade=t=out:st=0:d=${fadeOut},volume=${volume}"`;
  } else if (volume !== 1.0) {
    filter = `-af "volume=${volume}"`;
  }

  execSync(`${FFMPEG} -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac ${filter} "${outputPath}"`, {
    stdio: "pipe",
  });
}

/**
 * Convert image sequence to video.
 */
export function imagesToVideo(
  imagePaths: string[],
  outputPath: string,
  fps: number = 30,
  durationPerImage: number = 2
): void {
  const totalDuration = imagePaths.length * durationPerImage;
  const listPath = outputPath + ".fifo.txt";
  require("fs").writeFileSync(listPath, imagePaths.map((p) => `file '${p}'`).join("\n"), "utf-8");

  execSync(
    `${FFMPEG} -y -f concat -safe 0 -i "${listPath}" -vf "fps=${fps},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -t ${totalDuration} "${outputPath}"`,
    { stdio: "pipe" }
  );

  require("fs").unlinkSync(listPath);
}

/**
 * Trim video to a specific time range.
 */
export function trimVideo(
  inputPath: string,
  outputPath: string,
  start: string,
  duration: string
): void {
  execSync(
    `${FFMPEG} -y -ss ${start} -i "${inputPath}" -t ${duration} -c copy "${outputPath}"`,
    { stdio: "pipe" }
  );
}

/**
 * Create a screen recording from a sequence of screenshots with zoom effects.
 */
export function screenshotsToVideo(
  screenshotPaths: string[],
  audioPaths: string[],
  outputPath: string,
  options: {
    fps?: number;
    width?: number;
    height?: number;
    zoom?: { x: number; y: number; scale: number }[];
  } = {}
): string {
  const fps = options.fps ?? 30;
  const w = options.width ?? 1920;
  const h = options.height ?? 1080;

  // Build filter for image input loop + zoom
  const inputArgs = screenshotPaths.flatMap((p) => ["-loop", "1", "-i", p]);
  const filterParts: string[] = [];
  const numInputs = screenshotPaths.length;

  // Stack all inputs then select each for its duration
  // For simplicity, use fps output directly
  // Complex zoom effects can be added per-frame later

  const durationSec = 2; // per screenshot
  const totalDuration = screenshotPaths.length * durationSec;

  // Create concat of individual clips
  const clipPaths: string[] = [];
  screenshotPaths.forEach((img, i) => {
    const clipPath = outputPath + `.clip${i}.mp4`;
    const zoomFilter = options.zoom?.[i]
      ? `zoompan=z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${fps}`
      : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;

    execSync(
      `${FFMPEG} -y -loop 1 -i "${img}" -t ${durationSec} -vf "${zoomFilter}" -c:v libx264 -pix_fmt yuv420p -fps_mode cgo "${clipPath}"`,
      { stdio: "pipe" }
    );
    clipPaths.push(clipPath);
  });

  // Concatenate all clips
  const listPath = outputPath + ".clips.txt";
  require("fs").writeFileSync(listPath, clipPaths.map((p) => `file '${p}'`).join("\n"), "utf-8");

  execSync(
    `${FFMPEG} -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`,
    { stdio: "pipe" }
  );

  // Cleanup temp clips
  clipPaths.forEach((p) => require("fs").unlinkSync(p));
  require("fs").unlinkSync(listPath);

  return outputPath;
}
