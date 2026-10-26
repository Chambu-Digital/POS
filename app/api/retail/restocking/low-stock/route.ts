import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    let lowStockProducts: any[]

    if (branchContext) {
      // Branch-aware: use ProductInventory for branch-specific stock
      const inventories = await models.ProductInventory.find({
        userId: ownerId,
        branchId: branchContext,
      }).lean()

      const inventoryMap = new Map(
        inventories.map((inv: any) => [inv.productId.toString(), inv])
      )

      const branchProductIds = inventories.map((inv: any) => inv.productId)

      const products = await models.Product.find({
        userId: ownerId,
        _id: { $in: branchProductIds }
      })
        .populate('supplierId', 'name')
        .lean()

      // Override stock with branch inventory and filter for low stock
      lowStockProducts = products
        .map((product: any) => ({
          ...product,
          stock: inventoryMap.get(product._id.toString())?.stock ?? 0
        }))
        .filter((product: any) =>
          (product.stock || 0) < (product.lowStockThreshold || 0)
        )
    } else {
      // No branch context: use raw product stock
      lowStockProducts = await models.Product.find({
        userId: ownerId,
        $expr: { $lt: ['$stock', '$lowStockThreshold'] }
      })
        .populate('supplierId', 'name')
        .lean()
    }

    // Transform to standard restocking format
    const items = lowStockProducts.map((product: any) => {
      // Build descriptive name including brand, model, and variant
      const descriptor = [product.brand, product.model, product.variant]
        .filter(Boolean)
        .join(' ')

      return {
        moduleItemId: product._id.toString(),
        name: descriptor ? `${product.productName} (${descriptor})` : product.productName,
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
      }
    })

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Retail low stock error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch retail low stock items', details: error.message },
      { status: 500 }
    )
  }
}
