#!/usr/bin/env node

/**
 * Verify TOKEN_ENCRYPTION_KEY is configured and working
 * Run: node scripts/verify-encryption.js
 */

const crypto = require('crypto');

console.log('🔍 Checking TOKEN_ENCRYPTION_KEY configuration...\n');

const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

if (!encryptionKey) {
  console.error('❌ TOKEN_ENCRYPTION_KEY is NOT set');
  console.log('\nTo fix, run:');
  console.log('  vercel env add TOKEN_ENCRYPTION_KEY production');
  process.exit(1);
}

console.log('✅ TOKEN_ENCRYPTION_KEY is set');

try {
  const buffer = Buffer.from(encryptionKey, 'base64');

  if (buffer.length !== 32) {
    console.error(`❌ Key is ${buffer.length} bytes, should be 32 bytes`);
    process.exit(1);
  }

  console.log('✅ Key is valid base64 format');
  console.log('✅ Key is 32 bytes (256 bits) - correct size for AES-256');

  // Test encryption/decryption
  const plaintext = 'test_token_12345';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', buffer, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

  // Decrypt
  const [ivHex, authTagHex, ciphertext] = encryptedToken.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', buffer, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  if (decrypted === plaintext) {
    console.log('✅ Encryption/decryption test passed');
  } else {
    console.error('❌ Encryption/decryption test failed');
    process.exit(1);
  }

  console.log('\n✨ All checks passed! TOKEN_ENCRYPTION_KEY is ready to use.\n');

} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
