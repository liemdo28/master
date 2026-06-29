/**
 * Sprint 6.1 - Data at Rest Encryption
 * AES-256-GCM encryption for sensitive JSON files.
 * Key: ENCRYPTION_KEY env var (64 hex chars = 256 bits)
 * Fallback: derive from NODE_SECRET (warns on startup)
 * IV: random 12 bytes per encryption, prepended to ciphertext.
 * Auth tag: 16 bytes, appended to ciphertext.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32; // 256 bits

export interface EncryptedPayload {
  iv: string;   // base64
  data: string;  // base64 (ciphertext + auth tag)
  alg: string;
}

/** Get or derive the encryption key (32 bytes). */
export function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (hex && hex.length === KEY_LEN * 2) {
    return Buffer.from(hex, "hex");
  }
  const secret = process.env.NODE_SECRET;
  if (secret) {
    return crypto.scryptSync(secret, "mi-salt-v1", KEY_LEN);
  }
  const key = crypto.randomBytes(KEY_LEN);
  console.warn(
    "[Security] ENCRYPTION_KEY not set. Generated temporary key." +
    " Set ENCRYPTION_KEY=" + key.toString("hex") + " in .env to persist encrypted data."
  );
  return key;
}

/** Encrypt plaintext -> EncryptedPayload. Returns plaintext if ENCRYPTION_KEY=disable. */
export function encrypt(plaintext: string): string | EncryptedPayload {
  if (!plaintext) return "";
  if (process.env.ENCRYPTION_KEY === "disable") {
    return plaintext as unknown as EncryptedPayload;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM as crypto.CipherGCMTypes, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return { iv: iv.toString("base64"), data: encrypted.toString("base64"), alg: ALGORITHM };
}

/** Decrypt EncryptedPayload. Throws on auth tag mismatch (tamper detected). */
export function decrypt(payload: string | EncryptedPayload): string {
  if (!payload || typeof payload !== "object") return String(payload);
  if (process.env.ENCRYPTION_KEY === "disable") return "";
  const { iv, data, alg } = payload as EncryptedPayload;
  if (!iv || !data) return "";
  try {
    const key = getEncryptionKey();
    const ivBuf = Buffer.from(iv, "base64");
    const dataBuf = Buffer.from(data, "base64");
    const ciphertext = dataBuf.subarray(0, dataBuf.length - TAG_LEN);
    const tag = dataBuf.subarray(dataBuf.length - TAG_LEN);
    const decipher = crypto.createDecipheriv(alg as crypto.CipherGCMTypes, key, ivBuf);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (e) {
    throw new Error("Decryption failed (auth tag mismatch or corrupt data): " + (e as Error).message);
  }
}

/** Encrypt a JS value to JSON string. SafeJSON wraps encrypted payload with __encrypted flag. */
export function encryptJSON(obj: unknown): string {
  const plaintext = JSON.stringify(obj);
  const encrypted = encrypt(plaintext);
  if (typeof encrypted === "string") return encrypted;
  return JSON.stringify({ __encrypted: true, ...encrypted });
}

/** Decrypt JSON content. Handles both legacy plain JSON and encrypted SafeJSON format. */
export function decryptJSON<T = unknown>(content: string): T {
  try { return JSON.parse(content) as T; } catch { /* fall through */ }
  try {
    const wrapped = JSON.parse(content);
    if (wrapped && wrapped.__encrypted) {
      const plaintext = decrypt(wrapped);
      return JSON.parse(plaintext) as T;
    }
  } catch (e) {
    throw new Error("Cannot decrypt JSON: " + (e as Error).message);
  }
  throw new Error("Unknown file format");
}

/** Read and decrypt a JSON file. Returns defaultValue if missing or unreadable. */
export function readEncryptedJSON<T>(filePath: string, defaultValue: T): T {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return decryptJSON<T>(content);
  } catch {
    return defaultValue;
  }
}

/** Encrypt and write a JSON file atomically (write temp -> rename). */
export function writeEncryptedJSON<T>(filePath: string, data: T): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = encryptJSON(data);
  const tmpPath = filePath + ".tmp." + Date.now();
  fs.writeFileSync(tmpPath, content, "utf8");
  fs.renameSync(tmpPath, filePath);
}

/** Generate a new random encryption key (64 hex chars). */
export function generateKey(): string {
  return crypto.randomBytes(KEY_LEN).toString("hex");
}
