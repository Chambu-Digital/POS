// Velocity analysis service for restocking recommendations

export interface StockMovement {
  timestamp: Date | string
  type: 'IN' | 'OUT'
  quantity: number
  reason: string
}

export interface VelocityAnalysis {
  averageDailySales: number
  totalSold: number
  daysAnalyzed: number
  hasSufficientData: boolean
  confidence: 'high' | 'medium' | 'low'
}

export interface CoverageAnalysis {
  daysRemaining: number
  urgency: number // leadTime / daysRemaining
  willStockOut: boolean
  stockoutDate: Date | null
}

/**
 * Calculate sales velocity from stock movements
 */
export function calculateVelocity(
  movements: StockMovement[],
  days: number
): VelocityAnalysis {
  // Filter for SALE movements only
  const salesMovements = movements.filter(
    m => m.type === 'OUT' && m.reason === 'SALE'
  )

  const totalSold = salesMovements.reduce((sum, m) => sum + m.quantity, 0)
  const averageDailySales = days > 0 ? totalSold / days : 0

  // Determine confidence based on data quality
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (days >= 30 && salesMovements.length >= 10) {
    confidence = 'high'
  } else if (days >= 14 && salesMovements.length >= 5) {
    confidence = 'medium'
  }

  return {
    averageDailySales,
    totalSold,
    daysAnalyzed: days,
    hasSufficientData: salesMovements.length >= 3,
    confidence
  }
}

/**
 * Calculate stock coverage and urgency
 */
export function calculateCoverage(
  currentStock: number,
  averageDailySales: number,
  leadTimeDays: number
): CoverageAnalysis {
  if (averageDailySales === 0) {
    return {
      daysRemaining: Infinity,
      urgency: 0,
      willStockOut: false,
      stockoutDate: null
    }
  }

  const daysRemaining = currentStock / averageDailySales
  const urgency = leadTimeDays / daysRemaining
  const willStockOut = daysRemaining < leadTimeDays

  let stockoutDate: Date | null = null
  if (willStockOut && daysRemaining > 0) {
    stockoutDate = new Date()
    stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysRemaining))
  }

  return {
    daysRemaining,
    urgency,
    willStockOut,
    stockoutDate
  }
}

/**
 * Calculate recommended restock quantity
 */
export function calculateRecommendedQuantity(
  currentStock: number,
  averageDailySales: number,
  leadTimeDays: number,
  safetyBufferDays: number,
  incomingStock: number = 0
): number {
  const targetDays = leadTimeDays + safetyBufferDays
  const targetStock = averageDailySales * targetDays
  const effectiveStock = currentStock + incomingStock
  
  const deficit = Math.max(0, targetStock - effectiveStock)
  
  // Round up to nearest whole number
  return Math.ceil(deficit)
}

/**
 * Generate explanation for recommendation
 */
export function explainRecommendation(
  currentStock: number,
  velocity: VelocityAnalysis,
  coverage: CoverageAnalysis,
  recommendedQty: number,
  leadTimeDays: number
): string {
  const reasons: string[] = []

  if (coverage.willStockOut) {
    if (coverage.daysRemaining < 2) {
      reasons.push('⚠️ Critical: Will run out in less than 2 days')
    } else if (coverage.daysRemaining < leadTimeDays) {
      reasons.push(`⚠️ Will run out before next restock (${Math.floor(coverage.daysRemaining)} days remaining)`)
    }
  }

  if (velocity.averageDailySales > 0) {
    reasons.push(`📊 Average sales: ${velocity.averageDailySales.toFixed(1)} units/day`)
  }

  if (velocity.confidence === 'low') {
    reasons.push('⚡ Limited sales history - recommendation based on available data')
  }

  if (recommendedQty > 0) {
    reasons.push(`📦 Recommended quantity covers ${leadTimeDays} days + safety buffer`)
  }

  return reasons.join('\n')
}
