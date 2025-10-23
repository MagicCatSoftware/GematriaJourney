// server/utils/crypto.js
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // recommended for GCM

function mkKeyFromMaster(master) {
  // master should be 32 bytes (Buffer)
  if (!master || master.length < KEY_LEN) {
    throw new Error('MASTER_KEY must be 32 bytes');
  }
  return master.slice(0, KEY_LEN);
}

export function encryptWithKey(keyBuffer, plaintext) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, keyBuffer, iv, { authTagLength: 16 });
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64'); // iv(12) + tag(16) + ciphertext
}

export function decryptWithKey(keyBuffer, b64) {
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.slice(0, IV_LEN);
  const tag = raw.slice(IV_LEN, IV_LEN + 16);
  const ct = raw.slice(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, keyBuffer, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString('utf8');
}

// Generate a new random user key
export function generateUserKey() {
  return crypto.randomBytes(KEY_LEN);
}

// Encrypt userKey with master key
export function encryptUserKeyWithMaster(masterKeyBuffer, userKeyBuffer) {
  const mk = mkKeyFromMaster(masterKeyBuffer);
  return encryptWithKey(mk, userKeyBuffer.toString('base64'));
}

// Decrypt stored userKey with master key
export function decryptUserKeyWithMaster(masterKeyBuffer, encryptedUserKeyB64) {
  const mk = mkKeyFromMaster(masterKeyBuffer);
  const userKeyBase64 = decryptWithKey(mk, encryptedUserKeyB64);
  return Buffer.from(userKeyBase64, 'base64'); // returns Buffer
}