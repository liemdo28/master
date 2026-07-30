<?php
/**
 * EncryptionService - AES-256-GCM Password Encryption
 * 
 * Security Requirements:
 * - Master key from .env only (never commit to git)
 * - AES-256-GCM encryption
 * - IV and auth tag stored separately
 * - Never log passwords
 * - Never return encrypted payload in frontend unless authorized
 */
class EncryptionService {
    private const CIPHER = 'aes-256-gcm';
    private const TAG_LENGTH = 16;
    
    private static ?string $masterKey = null;
    
    /**
     * Get master key from environment
     * @throws Exception if key not configured
     */
    public static function getMasterKey(): string {
        if (self::$masterKey !== null) {
            return self::$masterKey;
        }
        
        $key = getenv('CREDENTIAL_ENCRYPTION_KEY');
        
        // Fallback to old key for migration
        if (empty($key)) {
            $key = getenv('ENCRYPTION_KEY');
        }
        
        if (empty($key)) {
            throw new Exception('CREDENTIAL_ENCRYPTION_KEY not configured in .env');
        }
        
        // Ensure key is 32 bytes for AES-256
        $keyHash = hash('sha256', $key, true);
        self::$masterKey = $keyHash;
        
        return self::$masterKey;
    }
    
    /**
     * Encrypt password using AES-256-GCM
     * 
     * @param string $password Plain text password
     * @return array ['encrypted' => string, 'iv' => string, 'tag' => string]
     * @throws Exception on encryption failure
     */
    public static function encrypt(string $password): array {
        $key = self::getMasterKey();
        
        // Generate random IV
        $ivLength = openssl_cipher_iv_length(self::CIPHER);
        $iv = openssl_random_pseudo_bytes($ivLength);
        
        $tag = '';
        $encrypted = openssl_encrypt(
            $password,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );
        
        if ($encrypted === false) {
            throw new Exception('Encryption failed');
        }
        
        return [
            'encrypted' => base64_encode($encrypted),
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag)
        ];
    }
    
    /**
     * Decrypt password
     * 
     * @param string $encryptedPassword Base64 encoded encrypted password
     * @param string $iv Base64 encoded IV
     * @param string $tag Base64 encoded auth tag
     * @return string Decrypted password
     * @throws Exception on decryption failure
     */
    public static function decrypt(string $encryptedPassword, string $iv, string $tag): string {
        $key = self::getMasterKey();
        
        $encrypted = base64_decode($encryptedPassword);
        $ivDecoded = base64_decode($iv);
        $tagDecoded = base64_decode($tag);
        
        $decrypted = openssl_decrypt(
            $encrypted,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $ivDecoded,
            $tagDecoded
        );
        
        if ($decrypted === false) {
            throw new Exception('Decryption failed - invalid key or corrupted data');
        }
        
        return $decrypted;
    }
    
    /**
     * Validate that encryption key is configured
     * 
     * @return bool
     */
    public static function isConfigured(): bool {
        try {
            self::getMasterKey();
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Generate a secure random password
     * 
     * @param int $length Password length
     * @return string Generated password
     */
    public static function generatePassword(int $length = 24): string {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        $password = '';
        $cryptoStrong = false;
        
        for ($i = 0; $i < $length; $i++) {
            $randomBytes = random_bytes(1);
            $index = ord($randomBytes) % strlen($chars);
            $password .= $chars[$index];
        }
        
        return $password;
    }
    
    /**
     * Calculate next rotation date based on frequency
     * 
     * @param int $frequencyDays Rotation frequency in days
     * @param DateTime|null $lastChanged Last password change date
     * @return DateTime Next rotation due date
     */
    public static function calculateNextRotation(int $frequencyDays, ?DateTime $lastChanged = null): DateTime {
        $fromDate = $lastChanged ?? new DateTime();
        return (clone $fromDate)->modify("+{$frequencyDays} days");
    }
}
