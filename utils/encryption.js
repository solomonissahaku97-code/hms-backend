require('dotenv').config();
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 64 hex chars (32 bytes)
const IV_LENGTH = 16;

// Encrypt
const encrypt = (text) => {
  console.log('Key length:', ENCRYPTION_KEY.length); // should print 32
  console.log(require('crypto').randomBytes(32).toString('hex'))
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

// Decrypt
const decrypt = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return null; // or just return encryptedText if you want to keep plain values
  }

  const [iv, encrypted] = encryptedText.split(':');
  if (!iv || !encrypted) {
    return encryptedText; // fallback: treat as plain text (useful for old records)
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};


module.exports = { encrypt, decrypt };
