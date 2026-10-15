/**
 * Currency formatting utilities
 * Centralizes currency display across the application
 */

// Default currency if settings not available
const DEFAULT_CURRENCY = 'KSh'

/**
 * Format a number as currency with proper symbol/code
 * @param amount - The numeric amount to format
 * @param currency - Currency code/symbol (e.g., 'KSh', 'USD', '$'). Defaults to KSh
 * @param includeDecimals - Whether to show decimal places. Defaults to true
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  includeDecimals: boolean = true
): string {
  const formattedAmount = includeDecimals
    ? amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  
  return `${currency} ${formattedAmount}`
}

/**
 * Get currency symbol/code from settings or default
 * This should be called with settings object from API
 */
export function getCurrencyFromSettings(settings?: any): string {
  return settings?.general?.currency || settings?.currency || DEFAULT_CURRENCY
}

/**
 * Compact currency format for tight spaces (no decimals)
 */
export function formatCurrencyCompact(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return formatCurrency(amount, currency, false)
}
