const crypto = require('crypto');

/**
 * Resolves the 256-bit encryption key buffer from hex string.
 * @param {string} keyHex - 64-character hex string (32 bytes)
 * @returns {Buffer}
 */
function resolveKeyBuffer(keyHex) {
  if (!keyHex) {
    throw new Error('Encryption key is required.');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters).');
  }
  return key;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param {string} text - Plaintext to encrypt
 * @param {string} keyHex - 32-byte encryption key in hex
 * @returns {string} Colon-separated string: "ivHex:authTagHex:encryptedTextHex"
 */
function encrypt(text, keyHex) {
  const key = resolveKeyBuffer(keyHex);
  const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');
  
  return `${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted payload.
 * @param {string} encryptedPayload - Format: "ivHex:authTagHex:encryptedTextHex"
 * @param {string} keyHex - 32-byte encryption key in hex
 * @returns {string} Plaintext
 */
function decrypt(encryptedPayload, keyHex) {
  const key = resolveKeyBuffer(keyHex);
  
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format.');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');
  
  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Invalid initialization vector or authentication tag length.');
  }
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
