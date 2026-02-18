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
 * Validate imported products with enhanced error checking
 */
export function validateProducts(products: any[]): { valid: any[]; errors: string[] } {
  const valid = []
  const errors = []

  products.forEach((product, index) => {
    const rowErrors: string[] = []
    const rowNum = index + 2 // Account for header row

    // Required field validation
    if (!product.productName || product.productName.trim() === '') {
      rowErrors.push('Product name is required')
    } else if (product.productName.length > 200) {
      rowErrors.push('Product name too long (max 200 characters)')
    }

    if (!product.category || product.category.trim() === '') {
      rowErrors.push('Category is required')
    } else if (product.category.length > 100) {
      rowErrors.push('Category name too long (max 100 characters)')
    }

    // Price validation
    if (product.buyingPrice === undefined || product.buyingPrice === '' || product.buyingPrice === null) {
      rowErrors.push('Buying price is required')
    } else if (isNaN(product.buyingPrice) || product.buyingPrice < 0) {
      rowErrors.push('Buying price must be a positive number')
    }

    if (product.sellingPrice === undefined || product.sellingPrice === '' || product.sellingPrice === null) {
      rowErrors.push('Selling price is required')
    } else if (isNaN(product.sellingPrice) || product.sellingPrice < 0) {
      rowErrors.push('Selling price must be a positive number')
    }

    // Stock validation
    if (product.stock === undefined || product.stock === '' || product.stock === null) {
      rowErrors.push('Stock is required')
    } else if (isNaN(product.stock) || product.stock < 0) {
      rowErrors.push('Stock must be a positive number')
    } else if (!Number.isInteger(Number(product.stock))) {
      rowErrors.push('Stock must be a whole number')
    }

    // Optional field validation
    if (product.wholeSale !== undefined && product.wholeSale !== '' && product.wholeSale !== null) {
      if (isNaN(product.wholeSale) || product.wholeSale < 0) {
        rowErrors.push('Wholesale price must be a positive number')
      }
    }

    // Business logic validation
    if (product.sellingPrice && product.buyingPrice && product.sellingPrice < product.buyingPrice) {
      rowErrors.push('Warning: Selling price is less than buying price')
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`)
    } else {
      // Sanitize and normalize data
      valid.push({
        ...product,
        productName: product.productName.trim(),
        category: product.category.trim(),
        brand: product.brand?.trim() || '',
        model: product.model?.trim() || '',
        variant: product.variant?.trim() || '',
        unit: product.unit?.trim() || 'piece',
        description: product.description?.trim() || '',
        stock: Math.floor(Number(product.stock)),
        buyingPrice: Number(product.buyingPrice),
        sellingPrice: Number(product.sellingPrice),
        wholeSale: product.wholeSale ? Number(product.wholeSale) : 0,
      })
    }
  })

  return { valid, errors }
}
