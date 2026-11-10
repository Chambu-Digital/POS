// ─── Buying price permission helpers ──────────────────────────────────────────
// Single source of truth for the pos.buying-price permission check.
// Import these into API routes instead of repeating the check inline.

import type { TokenPayload } from '@/lib/jwt'

/**
 * Returns true if the caller is allowed to see buying prices.
 * - Owners (type: 'user') always can.
 * - Staff need the 'pos.buying-price' permission explicitly set to true.
 */
export function canSeeBuyingPrice(payload: TokenPayload): boolean {
  if (payload.type === 'user') return true
  return payload.permissions?.['pos.buying-price'] === true
}

/**
 * Strips buyingPrice from every object in an array.
 * Used on GET responses when the caller lacks pos.buying-price.
 */
export function stripBuyingPrice<T extends Record<string, any>>(items: T[]): Omit<T, 'buyingPrice'>[] {
  return items.map(({ buyingPrice, ...rest }) => rest as Omit<T, 'buyingPrice'>)
}

/**
 * Strips buyingPrice from a single object.
 * Used on single-product GET responses.
 */
export function stripBuyingPriceOne<T extends Record<string, any>>(item: T): Omit<T, 'buyingPrice'> {
  const { buyingPrice, ...rest } = item
  return rest as Omit<T, 'buyingPrice'>
}

/** Standard 403 response for write attempts without the permission. */
export function buyingPriceForbidden() {
  return Response.json(
    { error: 'You do not have permission to create products, contact admin' },
    { status: 403 }
  )
}
