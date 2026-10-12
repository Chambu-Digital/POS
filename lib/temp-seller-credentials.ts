// ─── Temporary Seller Credential Generation ────────────────────────────────────
// Auto-generate username and PIN for mobile shop temp sellers

/**
 * Generates a username for a temp seller
 * Format: temp-{firstName}-{count}
 * Example: temp-john-001, temp-mary-002
 */
export function generateTempUsername(firstName: string, count: number): string {
  const sanitized = firstName.toLowerCase().replace(/[^a-z]/g, '')
  const padded = String(count).padStart(3, '0')
  return `temp-${sanitized}-${padded}`
}

/**
 * Generates a random 4-digit PIN
 */
export function generateTempPIN(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * Creates printable credentials for a temp seller
 */
export interface TempSellerCredentials {
  name: string
  username: string
  pin: string
  shopName: string
  date: string
}

export function formatCredentialCard(creds: TempSellerCredentials): string {
  return `
╔════════════════════════════════════════╗
║       MOBILE SHOP CREDENTIALS          ║
╠════════════════════════════════════════╣
║ Name:     ${creds.name.padEnd(28)} ║
║ Username: ${creds.username.padEnd(28)} ║
║ PIN:      ${creds.pin.padEnd(28)} ║
║                                        ║
║ Shop:     ${creds.shopName.padEnd(28)} ║
║ Date:     ${creds.date.padEnd(28)} ║
╚════════════════════════════════════════╝
`.trim()
}
