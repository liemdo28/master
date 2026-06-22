"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMachineToken = exports.decrypt = exports.encrypt = exports.deriveKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
/**
 * Derives a 256-bit key from a passphrase using PBKDF2.
 * Salt should be stored alongside the encrypted data.
 */
function deriveKey(passphrase, salt) {
    return crypto_1.default.pbkdf2Sync(passphrase, salt, 100000, KEY_LENGTH, 'sha256');
}
exports.deriveKey = deriveKey;
/**
 * Encrypts plaintext with AES-256-GCM.
 * Returns a Buffer: [salt(16)] + [iv(16)] + [tag(16)] + [ciphertext]
 */
function encrypt(plaintext, passphrase) {
    const salt = crypto_1.default.randomBytes(16);
    const key = deriveKey(passphrase, salt);
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}
exports.encrypt = encrypt;
/**
 * Decrypts a base64 string produced by encrypt().
 */
function decrypt(encryptedData, passphrase) {
    const data = Buffer.from(encryptedData, 'base64');
    const salt = data.subarray(0, 16);
    const iv = data.subarray(16, 32);
    const tag = data.subarray(32, 48);
    const ciphertext = data.subarray(48);
    const key = deriveKey(passphrase, salt);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
exports.decrypt = decrypt;
/**
 * Generates a random machine token for authentication.
 */
function generateMachineToken() {
    return crypto_1.default.randomBytes(32).toString('base64url');
}
exports.generateMachineToken = generateMachineToken;
//# sourceMappingURL=encryption.js.map