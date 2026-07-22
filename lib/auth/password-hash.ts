import crypto from 'crypto'

// Use our own application salt, not ResetAPI's salt
const SALT = process.env.CHAMBU_PASSWORD_SALT || 'chambu-pos-default-salt-v1'

if (!process.env.CHAMBU_PASSWORD_SALT) {
  console.warn('[password-hash] CHAMBU_PASSWORD_SALT not set in environment, using default salt')
}

/**
 * Hash password using PBKDF2-HMAC-SHA512 with 100,000 iterations
 */
export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 100000, 64, 'sha512').toString('hex')
}

/**
 * Verify login by comparing entered password with stored hash
 */
export function verifyPassword(entered: string, storedHash: string): boolean {
  const result = hashPassword(entered) === storedHash
  if (!result) {
    console.log('[password-hash] Password verification failed')
  }
  return result
}
