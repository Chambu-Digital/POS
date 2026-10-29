import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

interface BulkUpdateItem {
  id: string
  updates: {
    buyingPrice?: number
    sellingPrice?: number
    wholeSale?: number
    barcode?: string
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json() as { items: BulkUpdateItem[] }
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json({ error: 'No items to update' }, { status: 400 })
    }

    // Allowed fields only
    const allowedFields = ['buyingPrice', 'sellingPrice', 'wholeSale', 'barcode']
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const item of data.items) {
      try {
        // Validate updates only contain allowed fields
        const r2 = (v: any) => v != null ? Math.round(parseFloat(v) * 100) / 100 : v
        const updates = Object.keys(item.updates).reduce((acc: any, key) => {
          if (allowedFields.includes(key)) {
            const val = item.updates[key as keyof typeof item.updates]
            // Round price fields to 2 decimal places
            acc[key] = ['buyingPrice', 'sellingPrice', 'wholeSale'].includes(key) ? r2(val) : val
          }
          return acc
        }, {})

        // Reject if trying to update stock
        if ('stock' in item.updates) {
          throw new Error('Stock cannot be directly updated. Use stock movements instead.')
        }

        // Update product
        const product = await models.Product.findOneAndUpdate(
          { _id: new Types.ObjectId(item.id), userId: ownerId },
          { ...updates, updatedAt: new Date() },
          { new: true }
        )

        if (!product) {
          errorCount++
          results.push({ id: item.id, success: false, error: 'Product not found' })
        } else {
          successCount++
          results.push({ id: item.id, success: true, product })
        }
      } catch (err: any) {
        errorCount++
        results.push({ id: item.id, success: false, error: err.message })
      }
    }

    return NextResponse.json({
      successCount,
      errorCount,
      results,
      message: `Updated ${successCount} product(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`
    })
  } catch (error) {
    console.error('[products/bulk-update] error:', error)
    return NextResponse.json({ error: 'Failed to update products' }, { status: 500 })
  }
}
