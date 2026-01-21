// utils/encryption.js
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts plaintext with a key
 * Returns { cipherText, iv, authTag } for decryption
 */
export const encrypt = (plaintext, key) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, "hex"), iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return { cipherText: encrypted, iv: iv.toString("hex"), authTag };
};

/**
 * Decrypts ciphertext with a key
 */
export const decrypt = (cipherText, key, ivHex, authTagHex) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, "hex"), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(cipherText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

/**
 * Generates a secure random 32-byte key for AES-256
 */
export const generateKey = () => crypto.randomBytes(32).toString("hex");
