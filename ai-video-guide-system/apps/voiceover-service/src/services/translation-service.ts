// src/services/translation-service.ts
// Translates scripts between EN and VI using OpenAI GPT.
// Reuses the same OpenAI client pattern as narration-service.
import OpenAI from "openai";
import { OPENAI_API_KEY, OPENAI_BASE_URL, AI_MODEL } from "../config.js";

const client = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });

const VI_TO_EN_PROMPT = `You are a professional translator for training videos. Translate the Vietnamese script below into natural, fluent English. Preserve all brand names, product names, location names, and numbers exactly as written. Use natural spoken English, not a literal word-for-word translation. Return only the translated script.`;
const EN_TO_VI_PROMPT = `Bạn là một người dịch chuyên nghiệp cho video training. Dịch đoạn script tiếng Anh dưới đây sang tiếng Việt tự nhiên, lưu loát. Giữ nguyên tên thương hiệu, tên sản phẩm, địa điểm và số liệu. Sử dụng tiếng Việt tự nhiên, không dịch máy. Chỉ trả về bản dịch.`;

export async function translateToEnglish(viText: string): Promise<string> {
  if (!viText.trim()) return "";
  if (!OPENAI_API_KEY) return localFallbackViToEn(viText);
  try {
    const resp = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: VI_TO_EN_PROMPT },
        { role: "user", content: viText },
      ],
      max_tokens: 2048, temperature: 0.3,
    });
    return resp.choices[0]?.message?.content?.trim() ?? localFallbackViToEn(viText);
  } catch { return localFallbackViToEn(viText); }
}

export async function translateToVietnamese(enText: string): Promise<string> {
  if (!enText.trim()) return "";
  if (!OPENAI_API_KEY) return localFallbackEnToVi(enText);
  try {
    const resp = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: EN_TO_VI_PROMPT },
        { role: "user", content: enText },
      ],
      max_tokens: 2048, temperature: 0.3,
    });
    return resp.choices[0]?.message?.content?.trim() ?? localFallbackEnToVi(enText);
  } catch { return localFallbackEnToVi(enText); }
}

// ── Local fallback translator (no OpenAI key required) ───────────────────────
// Used only for development / demo when no API key is available.
// Production: always provide OPENAI_API_KEY so GPT-4 produces natural translations.
const COMMON_TERMS: Record<string, { vi: string; en: string }> = {
  "bakudan ramen": { vi: "bakudan ramen", en: "Bakudan Ramen" },
  "welcome to": { vi: "chào mừng bạn đến với", en: "Welcome to" },
  "in this video": { vi: "trong video này", en: "In this video" },
  "we will guide you": { vi: "chúng tôi sẽ hướng dẫn bạn", en: "we will guide you" },
  "the correct": { vi: "đúng quy trình", en: "the correct" },
  "opening procedure": { vi: "quy trình mở cửa", en: "opening procedure" },
  "food safety": { vi: "an toàn thực phẩm", en: "food safety" },
  "food-safety": { vi: "an toàn thực phẩm", en: "food-safety" },
  "checks": { vi: "kiểm tra", en: "checks" },
  "steps required": { vi: "các bước cần thiết", en: "steps required" },
  "before service begins": { vi: "trước khi bắt đầu phục vụ", en: "before service begins" },
  "stone oak": { vi: "xtôn âu-k", en: "Stone Oak" },
  "the rim": { vi: "đờ-rim", en: "The Rim" },
  "bandera": { vi: "ban-đe-ra", en: "Bandera" },
  "doordash": { vi: "đo-đét", en: "DoorDash" },
  "stone oak opens": { vi: "xtôn âu-k mở cửa", en: "Stone Oak opens" },
  "at 11:00 am": { vi: "lúc 11 giờ sáng", en: "at 11:00 AM" },
  "opens at": { vi: "mở cửa lúc", en: "opens at" },
  "today revenue": { vi: "doanh thu hôm nay", en: "today's revenue" },
  "increased by": { vi: "tăng", en: "increased by" },
  "today": { vi: "hôm nay", en: "today" },
  "15%": { vi: "mười lăm phần trăm", en: "fifteen percent" },
  "order": { vi: "đơn hàng", en: "order" },
  "order number": { vi: "đơn hàng số", en: "order number" },
  "needs to be checked": { vi: "cần được kiểm tra", en: "needs to be checked" },
  "before 7:30 pm": { vi: "trước 7 giờ 30 tối", en: "before 7:30 PM" },
};

function localFallbackEnToVi(enText: string): string {
  let out = enText;
  for (const [en, pair] of Object.entries(COMMON_TERMS)) {
    if (en.length < 3) continue;
    const re = new RegExp(`\\b${en}\\b`, "gi");
    out = out.replace(re, pair.vi);
  }
  return out;
}

function localFallbackViToEn(viText: string): string {
  let out = viText;
  for (const [_, pair] of Object.entries(COMMON_TERMS)) {
    const re = new RegExp(pair.vi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, pair.en);
  }
  return out;
}
