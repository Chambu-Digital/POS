// ─── Mobile Shop Detail API ─────────────────────────────────────────────────────
// GET /api/mobile-shops/[id] - Get mobile shop details with live stats

import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/jwt'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getModels } from '@/lib/tenant/get-models'
import mongoose from 'mongoose'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const conn = await getTenantDB(req)
    const { MobileShop, Sale, Product } = getModels(conn)

    // Get mobile shop
    const shop = await MobileShop.findOne({
      _id: new mongoose.Types.ObjectId(params.id),
      userId: new mongoose.Types.ObjectId(ownerId),
    })
      .populate('sourceBranchId', 'name code address')
      .populate('sellers', 'name email phone isTemporary')
      .populate('closedBy', 'name')
      .lean()

    if (!shop) {
      return NextResponse.json({ message: 'Mobile shop not found' }, { status: 404 })
    }

    // Get live sales stats (sales made by temp sellers)
    const sellerIds = shop.sellers.map((s: any) => s._id)
    const sales = await Sale.find({
      userId: new mongoose.Types.ObjectId(ownerId),
      staffId: { $in: sellerIds },
      createdAt: { $gte: shop.deployedAt },
    })
      .populate('staffId', 'name')
      .sort({ createdAt: -1 })
      .lean()

    // Calculate current stats
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0)
    const salesCount = sales.length
    const itemsSold = sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0)
    }, 0)

    // Calculate current stock (stockOut - sold)
    const currentStock = shop.stockOut.map((stockItem: any) => {
      const sold = sales.reduce((sum, sale) => {
        const saleItem = sale.items.find((item: any) => 
          item.productId?.toString() === stockItem.productId.toString()
        )
        return sum + (saleItem?.quantity || 0)
      }, 0)

      return {
        productId: stockItem.productId,
        productName: stockItem.productName,
        deployed: stockItem.quantity,
        sold,
        remaining: stockItem.quantity - sold,
      }
    })

    return NextResponse.json({
      shop,
      liveStats: {
        totalRevenue,
        salesCount,
        itemsSold,
        currentStock,
      },
      sales,
    })
  } catch (error: any) {
    console.error('[mobile-shops/[id]] GET error:', error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
