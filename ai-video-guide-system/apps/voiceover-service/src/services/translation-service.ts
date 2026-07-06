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
  const resp = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: VI_TO_EN_PROMPT },
      { role: "user", content: viText },
    ],
    max_tokens: 2048,
    temperature: 0.3,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

export async function translateToVietnamese(enText: string): Promise<string> {
  if (!enText.trim()) return "";
  const resp = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: EN_TO_VI_PROMPT },
      { role: "user", content: enText },
    ],
    max_tokens: 2048,
    temperature: 0.3,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}
