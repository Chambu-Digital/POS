// ─── Historical Stock Service ──────────────────────────────────────────────────
// Reconstructs historical inventory balances from StockLedger transactions

interface HistoricalProductData {
  _id: any
  productName: string
  category: string
  variant?: string
  brand?: string
  unit?: string
  sellingPrice: number
  buyingPrice: number
  stock: number
  historicalCost: number
  valueAtCost: number
  valueAtRetail: number
  lowStockThreshold: number
}

interface HistoricalInventorySnapshot {
  products: HistoricalProductData[]
  summary: {
    totalProducts: number
    totalStockValue: number
    totalStockValueAtCost: number
    estimatedProfit: number
    lowStockItems: number
    outOfStockItems: number
  }
  metadata: {
    isHistorical: boolean
    asOfDate: Date
    dataCompleteness: 'complete' | 'partial' | 'unavailable'
    productsWithoutHistory: number
  }
}

interface StockMovementSummary {
  movements: any[]
  summary: {
    totalMovements: number
    byType: Record<string, { count: number; quantity: number }>
    openingBalance: number
    closingBalance: number
  }
}

/**
 * Get historical inventory snapshot as of a specific date
 * Reconstructs stock levels from StockLedger transactions
 */
export async function getHistoricalInventorySnapshot(
  models: any,
  userId: string,
  asOfDate: Date,
  branchId?: string
): Promise<HistoricalInventorySnapshot> {
  // Set cutoff to end of day
  const cutoff = new Date(asOfDate)
  cutoff.setHours(23, 59, 59, 999)

  // Get all products
  const query: any = { userId }
  const products = await models.Product.find(query).lean()

  let productsWithoutHistory = 0

  // Reconstruct stock for each product
  const inventoryData: HistoricalProductData[] = await Promise.all(
    products.map(async (product: any) => {
      // Get ledger entries up to cutoff date
      const ledgerQuery: any = {
        userId,
        productId: product._id,
        timestamp: { $lte: cutoff }
      }
      if (branchId) ledgerQuery.branchId = branchId

      const ledgerEntries = await models.StockLedger
        .find(ledgerQuery)
        .sort({ timestamp: 1 })
        .lean()

      if (ledgerEntries.length === 0) {
        productsWithoutHistory++
      }

      // Calculate historical stock from ledger
      let historicalStock = 0
      let totalCost = 0
      let totalUnitsReceived = 0

      for (const entry of ledgerEntries) {
        // Use newStock as the balance at that point
        historicalStock = entry.newStock

        // Track weighted average cost for STOCK_IN entries
        if (entry.type === 'STOCK_IN' && entry.unitCost) {
          totalCost += entry.unitCost * entry.quantity
          totalUnitsReceived += entry.quantity
        }
      }

      // Calculate average historical cost or fallback to current buying price
      const avgCost = totalUnitsReceived > 0 
        ? totalCost / totalUnitsReceived 
        : product.buyingPrice

      return {
        _id: product._id,
        productName: product.productName,
        category: product.category,
        variant: product.variant,
        brand: product.brand,
        unit: product.unit,
        sellingPrice: product.sellingPrice,
        buyingPrice: product.buyingPrice,
        stock: historicalStock,
        historicalCost: avgCost,
        valueAtCost: historicalStock * avgCost,
        valueAtRetail: historicalStock * product.sellingPrice,
        lowStockThreshold: product.lowStockThreshold || 10
      }
    })
  )

  // Calculate summary
  const totalStockValue = inventoryData.reduce((sum, p) => sum + p.valueAtRetail, 0)
  const totalStockValueAtCost = inventoryData.reduce((sum, p) => sum + p.valueAtCost, 0)
  const lowStockItems = inventoryData.filter(p => p.stock > 0 && p.stock < p.lowStockThreshold).length
  const outOfStockItems = inventoryData.filter(p => p.stock === 0).length

  // Determine data completeness
  let dataCompleteness: 'complete' | 'partial' | 'unavailable' = 'complete'
  if (productsWithoutHistory === products.length && products.length > 0) {
    dataCompleteness = 'unavailable'
  } else if (productsWithoutHistory > 0) {
    dataCompleteness = 'partial'
  }

  return {
    products: inventoryData,
    summary: {
      totalProducts: inventoryData.length,
      totalStockValue,
      totalStockValueAtCost,
      estimatedProfit: totalStockValue - totalStockValueAtCost,
      lowStockItems,
      outOfStockItems
    },
    metadata: {
      isHistorical: true,
      asOfDate: cutoff,
      dataCompleteness,
      productsWithoutHistory
    }
  }
}

/**
 * Get stock movements for a date range
 */
export async function getStockMovements(
  models: any,
  userId: string,
  startDate: Date,
  endDate: Date,
  branchId?: string,
  productId?: string
): Promise<StockMovementSummary> {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const query: any = {
    userId,
    timestamp: { $gte: start, $lte: end }
  }
  if (branchId) query.branchId = branchId
  if (productId) query.productId = productId

  const movements = await models.StockLedger
    .find(query)
    .populate('productId', 'productName category')
    .populate('branchId', 'name')
    .sort({ timestamp: -1 })
    .lean()

  // Group by type
  const byType: Record<string, { count: number; quantity: number }> = {}
  let openingBalance = 0
  let closingBalance = 0

  movements.forEach((m: any) => {
    const type = m.type || 'UNKNOWN'
    if (!byType[type]) {
      byType[type] = { count: 0, quantity: 0 }
    }
    byType[type].count++
    byType[type].quantity += Math.abs(m.quantity)
  })

  // Calculate opening and closing if single product
  if (productId && movements.length > 0) {
    // Get balance before start date
    const beforeStart = await models.StockLedger
      .findOne({
        userId,
        productId,
        timestamp: { $lt: start }
      })
      .sort({ timestamp: -1 })
      .lean()
    
    openingBalance = beforeStart?.newStock || 0
    
    // Get balance at end date
    const atEnd = await models.StockLedger
      .findOne({
        userId,
        productId,
        timestamp: { $lte: end }
      })
      .sort({ timestamp: -1 })
      .lean()
    
    closingBalance = atEnd?.newStock || 0
  }

  return {
    movements,
    summary: {
      totalMovements: movements.length,
      byType,
      openingBalance,
      closingBalance
    }
  }
}

/**
 * Get historical cost for a product at a specific date
 * Used for profit calculations
 */
export async function getHistoricalCost(
  models: any,
  userId: string,
  productId: string,
  asOfDate: Date
): Promise<number> {
  const cutoff = new Date(asOfDate)
  
  // Get most recent STOCK_IN entries before the date
  const stockInEntries = await models.StockLedger
    .find({
      userId,
      productId,
      type: 'STOCK_IN',
      timestamp: { $lte: cutoff },
      unitCost: { $exists: true, $gt: 0 }
    })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean()

  if (stockInEntries.length === 0) {
    // Fallback to current buying price
    const product = await models.Product.findById(productId).lean()
    return product?.buyingPrice || 0
  }

  // Calculate weighted average from recent stock-ins
  let totalCost = 0
  let totalQuantity = 0

  stockInEntries.forEach((entry: any) => {
    totalCost += entry.unitCost * entry.quantity
    totalQuantity += entry.quantity
  })

  return totalQuantity > 0 ? totalCost / totalQuantity : stockInEntries[0].unitCost
}
