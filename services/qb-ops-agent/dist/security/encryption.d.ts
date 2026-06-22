/// <reference types="node" />
/**
 * Derives a 256-bit key from a passphrase using PBKDF2.
 * Salt should be stored alongside the encrypted data.
 */
export declare function deriveKey(passphrase: string, salt: Buffer): Buffer;
/**
 * Encrypts plaintext with AES-256-GCM.
 * Returns a Buffer: [salt(16)] + [iv(16)] + [tag(16)] + [ciphertext]
 */
export declare function encrypt(plaintext: string, passphrase: string): string;
/**
 * Decrypts a base64 string produced by encrypt().
 */
export declare function decrypt(encryptedData: string, passphrase: string): string;
/**
 * Generates a random machine token for authentication.
 */
export declare function generateMachineToken(): string;
//# sourceMappingURL=encryption.d.ts.map