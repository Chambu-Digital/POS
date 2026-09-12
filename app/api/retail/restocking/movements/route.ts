import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const days = parseInt(searchParams.get('days') || '30')

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId is required' },
        { status: 400 }
      )
    }

    const { models } = await getTenantDB(request)

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch stock movements from StockLedger
    const movements = await models.StockLedger.find({
      productId: new Types.ObjectId(itemId),
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: 1 })
      .lean()

    // Transform to standard restocking format
    const standardMovements = movements.map((movement: any) => {
      // Determine type based on movement type
      let type: 'IN' | 'OUT'
      let reason: string

      switch (movement.type) {
        // OUT movements (stock decreases)
        case 'SALE':
          type = 'OUT'
          reason = 'SALE'
          break
        case 'RETURN':
        case 'DAMAGE':
        case 'WASTAGE':
        case 'EXPIRED':
        case 'LOSS':
          type = 'OUT'
          reason = movement.type
          break

        // IN movements (stock increases)
        case 'STOCK_IN':
        case 'PURCHASE':
          type = 'IN'
          reason = 'STOCK_IN'
          break
        case 'ADJUSTMENT':
          // Adjustments can be positive or negative
          type = movement.quantity >= 0 ? 'IN' : 'OUT'
          reason = 'ADJUSTMENT'
          break

        default:
          // Default to OUT for unknown types to be conservative
          type = 'OUT'
          reason = movement.type || 'OTHER'
      }

      return {
        timestamp: movement.timestamp,
        type,
        quantity: Math.abs(movement.quantity || 0),
        reason
      }
    })

    return NextResponse.json(standardMovements)
  } catch (error: any) {
    console.error('Retail movements error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch retail movements', details: error.message },
      { status: 500 }
    )
  }
}
