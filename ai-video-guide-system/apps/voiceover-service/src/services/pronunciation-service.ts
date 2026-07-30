// src/services/pronunciation-service.ts
// Applies the shared pronunciation dictionary before TTS synthesis.
// Section 8 — brand/store names, location names, special terms.
import { listPronunciations } from "../db.js";
import type { Language } from "@ai-video-guide/voiceover-core";

export function applyPronunciations(text: string, lang: Language): string {
  let result = text;
  try {
    const dict = listPronunciations();
    for (const entry of dict) {
      if (!entry.active) continue;
      if (entry.language !== "both" && entry.language !== lang) continue;
      const replacement = lang === "vi" ? entry.vi : entry.en;
      if (!replacement) continue;
      // Case-insensitive whole-word replacement
      const re = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, "gi");
      result = result.replace(re, replacement);
    }
  } catch {
    // DB not ready yet — skip pronunciation phase
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
