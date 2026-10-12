/**
 * Standardized product name formatting utility
 * Format: Brand › Variant › Model › ProductName
 * Ensures consistency across all inventory modals and forms
 */

interface Product {
  productName: string
  brand?: string
  variant?: string
  model?: string
  category?: string
}

/**
 * Format product name with full details for user input forms
 * @param product - Product object with name, brand, variant, model
 * @returns Formatted string: "Brand › Variant › Model › ProductName"
 */
export function formatProductName(product: Product): string {
  const parts = [
    product.brand,
    product.variant,
    product.model,
    product.productName,
  ].filter(Boolean)
  
  return parts.join(' › ')
}

/**
 * Format product name with category prefix (legacy format)
 * @param product - Product object
 * @returns Formatted string: "Category › Brand › Variant › Model › ProductName"
 */
export function formatProductNameWithCategory(product: Product): string {
  const parts = [
    product.category,
    product.brand,
    product.variant,
    product.model,
    product.productName,
  ].filter(Boolean)
  
  return parts.join(' › ')
}
