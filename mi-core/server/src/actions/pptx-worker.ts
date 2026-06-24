/**
 * PPTX Worker — create PowerPoint presentations.
 * Uses pptxgenjs. Output saved to action-outputs/pptx/.
 */

import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'action-outputs', 'pptx'
);

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface SlideContent {
  title: string;
  bullets?: string[];
  subtitle?: string;
  notes?: string;
}

export interface PptxCreateParams {
  filename: string;                // without .pptx
  title: string;                   // deck title
  author?: string;
  theme?: 'dark' | 'light' | 'corporate';
  slides: SlideContent[];
}

export interface PptxCreateResult {
  ok: boolean;
  file_path?: string;
  slide_count?: number;
  error?: string;
}

const THEMES = {
  dark:      { bg: '1a1a2e', title: 'e94560', text: 'ffffff', accent: '0f3460' },
  light:     { bg: 'ffffff', title: '2c3e50', text: '34495e', accent: '3498db' },
  corporate: { bg: 'f8f9fa', title: '1a3a5c', text: '2c3e50', accent: '2980b9' },
};

export async function createPresentation(params: PptxCreateParams): Promise<PptxCreateResult> {
  ensureDir();

  try {
    const PptxGenJS = require('pptxgenjs');
    const pptx = new PptxGenJS();
    const theme = THEMES[params.theme || 'corporate'];

    pptx.author   = params.author || 'Mi — Executive OS';
    pptx.company  = 'Mi Platform';
    pptx.subject  = params.title;
    pptx.title    = params.title;

    pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.33, height: 7.5 });
    pptx.layout = 'LAYOUT_WIDE';

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: theme.bg };
    titleSlide.addText(params.title, {
      x: 0.5, y: 2.5, w: '90%', h: 1.5,
      fontSize: 40, bold: true, color: theme.title, align: 'center',
    });
    if (params.slides[0]?.subtitle) {
      titleSlide.addText(params.slides[0].subtitle, {
        x: 0.5, y: 4.2, w: '90%', h: 0.8,
        fontSize: 20, color: theme.text, align: 'center',
      });
    }
    titleSlide.addText(`Mi | ${new Date().toLocaleDateString('vi-VN')}`, {
      x: 0.5, y: 6.8, w: '90%', h: 0.4,
      fontSize: 12, color: theme.text, align: 'center', italic: true,
    });

    // Content slides
    for (const slide of params.slides) {
      const s = pptx.addSlide();
      s.background = { color: theme.bg };

      // Title bar
      s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.1, fill: { color: theme.accent },
      });
      s.addText(slide.title, {
        x: 0.3, y: 0.1, w: '95%', h: 0.9,
        fontSize: 24, bold: true, color: 'ffffff',
      });

      // Bullets
      if (slide.bullets && slide.bullets.length > 0) {
        const bulletText = slide.bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 18, color: theme.text } }));
        s.addText(bulletText, {
          x: 0.5, y: 1.4, w: '90%', h: 5.5,
          valign: 'top',
        });
      }

      if (slide.notes) {
        s.addNotes(slide.notes);
      }
    }

    const filename = params.filename.replace(/\.pptx$/i, '') + '.pptx';
    const filePath = path.join(OUTPUT_DIR, filename);
    await pptx.writeFile({ fileName: filePath });

    return { ok: true, file_path: filePath, slide_count: params.slides.length + 1 };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function createExecutiveReport(reportData: {
  title: string;
  date: string;
  sections: Array<{ heading: string; points: string[] }>;
}): Promise<PptxCreateResult> {
  return createPresentation({
    filename: `executive-report-${reportData.date}`,
    title: reportData.title,
    theme: 'corporate',
    slides: reportData.sections.map(s => ({
      title: s.heading,
      bullets: s.points,
    })),
  });
}
