import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Query products where stock < lowStockThreshold
    const lowStockProducts = await models.Product.find({
      userId: ownerId,
      $expr: { $lt: ['$stock', '$lowStockThreshold'] }
    })
      .populate('supplierId', 'name')
      .lean()

    // Transform to standard restocking format
    const items = lowStockProducts.map((product: any) => ({
      moduleItemId: product._id.toString(),
      name: product.productName + (product.variant ? ` (${product.variant})` : ''),
      category: product.category || 'Uncategorized',
      currentStock: product.stock || 0,
      lowStockThreshold: product.lowStockThreshold || 0,
      buyingPrice: product.buyingPrice || 0,
      sellingPrice: product.price || 0,
      supplier: product.supplierId
        ? {
            id: product.supplierId._id?.toString() || product.supplierId.toString(),
            name: product.supplierId.name || 'Unknown Supplier'
          }
        : null
    }))

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Retail low stock error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch retail low stock items', details: error.message },
      { status: 500 }
    )
  }
}
