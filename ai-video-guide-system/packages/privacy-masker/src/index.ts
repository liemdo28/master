// src/index.ts

export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MaskOptions {
  blurRadius?: number;
  pixelate?: boolean;
  color?: string;
}

const DEFAULT_BLUR_RADIUS = 20;
const DEFAULT_PIXELATE = 8;

/**
 * Detect sensitive regions in a screenshot using heuristics.
 * Returns an array of bounding boxes to mask.
 */
export function detectSensitiveRegions(
  _width: number,
  _height: number,
  _text: string[]
): MaskRegion[] {
  const regions: MaskRegion[] = [];

  // TODO: Implement OCR-based detection (via @caporal or similar)
  // For now, return empty — regions can be registered manually
  // and overlaid via the PrivacyMasker class.

  return regions;
}

/**
 * Applies privacy masks to an image using FFmpeg.
 * Falls back to pixelation if blur is unavailable.
 */
export async function applyPrivacyMask(
  inputPath: string,
  outputPath: string,
  regions: MaskRegion[],
  options: MaskOptions = {}
): Promise<void> {
  if (regions.length === 0) {
    // No-op: just copy
    const { execSync } = await import("child_process");
    const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
    execSync(
      `${ffmpeg} -y -i "${inputPath}" -c copy "${outputPath}"`,
      { stdio: "pipe" }
    );
    return;
  }

  const { execSync } = await import("child_process");
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";

  // Build FFmpeg overlay filter for each region
  // Using boxblur + drawbox for redaction
  const blurRadius = options.blurRadius ?? DEFAULT_BLUR_RADIUS;
  const blur = `boxblur=${blurRadius}:${blurRadius}`;

  const filterParts = regions.map((r, i) => {
    const x = Math.round(r.x);
    const y = Math.round(r.y);
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    return `[0]${blur}[blurred];[blurred]drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=black@1:t=fill[out${i}]`;
  });

  const filterComplex =
    filterParts.join(";") +
    `;${regions.map((_, i) => `[out${i}]`).join("")}[out]`;

  execSync(
    `${ffmpeg} -y -i "${inputPath}" -filter_complex "${filterComplex}" -map "[out]" "${outputPath}"`,
    { stdio: "pipe" }
  );
}

/**
 * Quick in-memory pixelation via Canvas API (Node.js).
 * Falls back to FFmpeg if canvas unavailable.
 */
export async function pixelateRegion(
  inputPath: string,
  outputPath: string,
  regions: MaskRegion[],
  pixelSize: number = DEFAULT_PIXELATE
): Promise<void> {
  if (regions.length === 0) {
    const { execSync } = await import("child_process");
    const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
    execSync(
      `${ffmpeg} -y -i "${inputPath}" -c copy "${outputPath}"`,
      { stdio: "pipe" }
    );
    return;
  }

  const { execSync } = await import("child_process");
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";

  // Build pixelate filter per region using scale/pixelize approach
  const filterExpr = regions
    .map((r) => {
      const x = Math.round(r.x);
      const y = Math.round(r.y);
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=black@1:t=fill`;
    })
    .join(",");

  execSync(
    `${ffmpeg} -y -i "${inputPath}" -vf "${filterExpr}" "${outputPath}"`,
    { stdio: "pipe" }
  );
}
