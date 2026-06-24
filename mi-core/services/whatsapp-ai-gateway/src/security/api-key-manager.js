/**
 * ApiKeyManager
 *
 * Generates, hashes, and validates API keys.
 * Uses SHA-256 with a random salt.
 * Raw key is shown only at creation time — never stored.
 */

const crypto = require('crypto');

const KEY_BYTES = 36; // 36 random bytes → 72 hex chars
const SALT_BYTES = 16;
const HASH_ALGO = 'sha256';

/**
 * Generate a cryptographically random API key.
 * @returns {{ rawKey: string, hash: string, prefix: string }}
 */
function generateApiKey() {
  const rawKey = crypto.randomBytes(KEY_BYTES).toString('hex');
  const prefix = rawKey.slice(0, 8);
  const hash = hashKey(rawKey);
  return { rawKey, hash, prefix };
}

/**
 * Hash an API key with a random salt.
 * Format: "salt:hex_hash"
 * @param {string} rawKey
 * @returns {string}
 */
function hashKey(rawKey) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const h = crypto.createHash(HASH_ALGO).update(salt + rawKey).digest('hex');
  return `${salt}:${h}`;
}

/**
 * Validate a raw key against a stored hash.
 * @param {string} rawKey
 * @param {string} storedHash — format "salt:hex_hash"
 * @returns {boolean}
 */
function validateKey(rawKey, storedHash) {
  if (!rawKey || !storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expected] = parts;
  const actual = crypto.createHash(HASH_ALGO).update(salt + rawKey).digest('hex');
  return actual === expected;
}

/**
 * Generate a display-friendly key ID (first 8 chars of hash).
 * @param {string} rawKey
 * @returns {string}
 */
function generateKeyId(rawKey) {
  if (!rawKey) return '????';
  return rawKey.slice(0, 8);
}

module.exports = {
  generateApiKey,
  hashKey,
  validateKey,
  generateKeyId,
};
