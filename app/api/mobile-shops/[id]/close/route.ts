// ─── Close Mobile Shop API ──────────────────────────────────────────────────────
// POST /api/mobile-shops/[id]/close - Close shop, reconcile stock, deactivate sellers

import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/jwt'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getModels } from '@/lib/tenant/get-models'
import mongoose from 'mongoose'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const body = await req.json()
    const { stockReturned, notes } = body // stockReturned: [{ productId, productName, quantity }]

    if (!stockReturned || !Array.isArray(stockReturned)) {
      return NextResponse.json(
        { message: 'stockReturned array is required' },
        { status: 400 }
      )
    }

    const { conn } = await getTenantDB(req)
    const { MobileShop, Staff, ProductInventory, Sale } = getModels(conn)

    // Get mobile shop
    const shop = await MobileShop.findOne({
      _id: new mongoose.Types.ObjectId(params.id),
      userId: new mongoose.Types.ObjectId(ownerId),
    })

    if (!shop) {
      return NextResponse.json({ message: 'Mobile shop not found' }, { status: 404 })
    }

    if (shop.status === 'closed') {
      return NextResponse.json({ message: 'Mobile shop already closed' }, { status: 400 })
    }

    // Get all sales made by the mobile shop sellers
    const sellerIds = shop.sellers
    const sales = await Sale.find({
      userId: new mongoose.Types.ObjectId(ownerId),
      staffId: { $in: sellerIds },
      createdAt: { $gte: shop.deployedAt },
    }).lean()

    // Calculate sales summary
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0)
    const salesCount = sales.length
    const itemsSold = sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0)
    }, 0)

    // Calculate variance for each product
    const variance = []
    for (const stockItem of shop.stockOut) {
      // Calculate how much was sold
      const sold = sales.reduce((sum, sale) => {
        const saleItem = sale.items.find((item: any) => 
          item.productId?.toString() === stockItem.productId.toString()
        )
        return sum + (saleItem?.quantity || 0)
      }, 0)

      // Expected remaining = deployed - sold
      const expected = stockItem.quantity - sold

      // Actual returned
      const returnedItem = stockReturned.find(
        (r: any) => r.productId === stockItem.productId.toString()
      )
      const actual = returnedItem?.quantity || 0

      // Difference (negative = loss/shortage, positive = surplus)
      const difference = actual - expected

      variance.push({
        productId: stockItem.productId,
        productName: stockItem.productName,
        deployed: stockItem.quantity,
        sold,
        expected,
        actual,
        difference,
        notes: difference !== 0 ? (difference < 0 ? 'Shortage' : 'Surplus') : 'Balanced',
      })

      // Return stock to source branch
      if (actual > 0) {
        await ProductInventory.findOneAndUpdate(
          {
            userId: new mongoose.Types.ObjectId(ownerId),
            branchId: shop.sourceBranchId,
            productId: stockItem.productId,
          },
          {
            $inc: { stock: actual },
            $set: { lastUpdated: new Date() },
          },
          { upsert: true }
        )
      }
    }

    // Update mobile shop
    shop.status = 'closed'
    shop.closedAt = new Date()
    shop.closedBy = session.staffId 
      ? new mongoose.Types.ObjectId(session.staffId)
      : new mongoose.Types.ObjectId(session.userId)
    shop.stockReturned = stockReturned.map((item: any) => ({
      productId: new mongoose.Types.ObjectId(item.productId),
      productName: item.productName,
      quantity: item.quantity,
      returnedAt: new Date(),
    }))
    shop.salesMade = {
      totalRevenue,
      salesCount,
      itemsSold,
    }
    shop.variance = variance
    if (notes) shop.notes = notes

    await shop.save()

    // Deactivate temp sellers
    await Staff.updateMany(
      { _id: { $in: sellerIds }, isTemporary: true },
      {
        $set: {
          active: false,
          mobileShopId: null,
        },
      }
    )

    // Populate for response
    const populated = await MobileShop.findById(shop._id)
      .populate('sourceBranchId', 'name code')
      .populate('sellers', 'name email isTemporary active')
      .populate('closedBy', 'name')
      .lean()

    return NextResponse.json({
      message: 'Mobile shop closed successfully',
      shop: populated,
      variance,
    })
  } catch (error: any) {
    console.error('[mobile-shops/[id]/close] POST error:', error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
