// Known product field mappings
const FIELD_PATTERNS: Record<string, RegExp[]> = {
  productName: [
    /^product.?name$/i,
    /^name$/i,
    /^product$/i,
    /^item.?name$/i,
    /^product_name$/i,
    /^product-name$/i,
  ],
  category: [
    /^category$/i,
    /^cat$/i,
    /^type$/i,
    /^product.?category$/i,
  ],
  variant: [
    /^variant$/i,
    /^var$/i,
    /^variation$/i,
  ],
  brand: [
    /^brand$/i,
    /^manufacturer$/i,
    /^make$/i,
  ],
  model: [
    /^model$/i,
    /^model.?number$/i,
    /^model_number$/i,
  ],
  unit: [
    /^unit$/i,
    /^unit.?of.?measure$/i,
    /^uom$/i,
    /^measurement$/i,
  ],
  buyingPrice: [
    /^buying.?price$/i,
    /^cost.?price$/i,
    /^purchase.?price$/i,
    /^b\.?p\.?$/i,
    /^buying_price$/i,
    /^cost_price$/i,
  ],
  sellingPrice: [
    /^selling.?price$/i,
    /^sale.?price$/i,
    /^retail.?price$/i,
    /^price$/i,
    /^s\.?p\.?$/i,
    /^selling_price$/i,
  ],
  wholeSale: [
    /^wholesale$/i,
    /^wholesale.?price$/i,
    /^w[./]sale$/i,
    /^wholesale_price$/i,
  ],
  stock: [
    /^stock$/i,
    /^quantity$/i,
    /^qty$/i,
    /^on.?hand$/i,
    /^inventory$/i,
  ],
  description: [
    /^description$/i,
    /^desc$/i,
    /^notes$/i,
  ],
}

export interface ColumnMapping {
  [csvColumn: string]: string | null // maps CSV column name to product field
}

export interface DetectionResult {
  mapping: ColumnMapping
  confidence: Record<string, number> // confidence level for each detection
}

/**
 * Auto-detect column mappings from CSV headers
 */
export function detectColumnMapping(headers: string[]): DetectionResult {
  const mapping: ColumnMapping = {}
  const confidence: Record<string, number> = {}

  headers.forEach((header) => {
    let bestMatch: string | null = null
    let bestConfidence = 0

    // Try to match against known patterns
    Object.entries(FIELD_PATTERNS).forEach(([fieldName, patterns]) => {
      patterns.forEach((pattern) => {
        if (pattern.test(header)) {
          // Exact match gets highest confidence
          const isExactMatch = header.toLowerCase() === fieldName.toLowerCase()
          const matchConfidence = isExactMatch ? 1 : 0.8

          if (matchConfidence > bestConfidence) {
            bestConfidence = matchConfidence
            bestMatch = fieldName
          }
        }
      })
    })

    mapping[header] = bestMatch
    confidence[header] = bestConfidence
  })

  return { mapping, confidence }
}

/**
 * Apply column mapping to transform CSV data
 */
export function applyMapping(csvData: Record<string, any>[], mapping: ColumnMapping): any[] {
  return csvData.map((row) => {
    const transformed: Record<string, any> = {}

    Object.entries(mapping).forEach(([csvColumn, fieldName]) => {
      if (fieldName && row[csvColumn] !== undefined && row[csvColumn] !== '') {
        // Type conversion for numeric fields
        if (['buyingPrice', 'sellingPrice', 'wholeSale', 'stock'].includes(fieldName)) {
          transformed[fieldName] = parseFloat(row[csvColumn]) || 0
        } else {
          transformed[fieldName] = row[csvColumn]
        }
      }
    })

    return transformed
  })
}

/**
 * Validate imported products
 */
export function validateProducts(products: any[]): { valid: any[]; errors: string[] } {
  const valid = []
  const errors = []

  products.forEach((product, index) => {
    const rowErrors: string[] = []

    if (!product.productName) {
      rowErrors.push('Product name is required')
    }
    if (!product.category) {
      rowErrors.push('Category is required')
    }
    if (product.buyingPrice === undefined || product.buyingPrice === '') {
      rowErrors.push('Buying price is required')
    }
    if (product.sellingPrice === undefined || product.sellingPrice === '') {
      rowErrors.push('Selling price is required')
    }
    if (product.stock === undefined || product.stock === '') {
      rowErrors.push('Stock is required')
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${index + 2}: ${rowErrors.join(', ')}`)
    } else {
      valid.push(product)
    }
  })

  return { valid, errors }
}
