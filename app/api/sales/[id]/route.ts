import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ─── GET /api/sales/[id] ──────────────────────────────────────────────────────
// Fetch sale details with populated product and customer information

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { id } = await params
    const saleId = new Types.ObjectId(id)
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })
      .populate('customerId', 'name phone email')
      .populate('returns.returnedBy', 'name')
      .lean()

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Manually populate staffId with proper name handling
    if (sale.staffId) {
      const staff = await conn.db.collection('staff').findOne({ _id: sale.staffId }) as any
      if (staff) {
        const staffName = staff.firstName && staff.lastName 
          ? `${staff.firstName} ${staff.lastName}`.trim()
          : staff.name || staff.email || 'Unknown Staff'
        
        sale.staffId = {
          _id: staff._id,
          name: staffName,
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
        } as any
      }
    } else {
      // No staffId means owner made the sale - fetch owner info
      const owner = await conn.db.collection('users').findOne({ _id: new Types.ObjectId(ownerId) }) as any
      if (owner) {
        const ownerName = owner.firstName && owner.lastName
          ? `${owner.firstName} ${owner.lastName}`.trim()
          : owner.shopName || owner.name || owner.email || 'Owner'
        
        sale.staffId = {
          _id: owner._id,
          name: ownerName,
          firstName: owner.firstName,
          lastName: owner.lastName,
          email: owner.email,
          isOwner: true,
        } as any
      }
    }

    // ── Backfill missing brand/model/variant for old orders ──────────────────
    // Collect productIds from items that are missing these fields
    const productIdsToLookup = new Set<string>()
    sale.items?.forEach((item: any) => {
      if (item.productId && (!item.brand && !item.model && !item.variant)) {
        productIdsToLookup.add(item.productId.toString())
      }
    })

    // Fetch product details if needed
    if (productIdsToLookup.size > 0) {
      const products = await conn.db.collection('products')
        .find({ _id: { $in: Array.from(productIdsToLookup).map(id => new Types.ObjectId(id)) } })
        .project({ _id: 1, brand: 1, model: 1, variant: 1 })
        .toArray()

      const productMap = new Map()
      products.forEach((p: any) => {
        productMap.set(p._id.toString(), {
          brand: p.brand || '',
          model: p.model || '',
          variant: p.variant || '',
        })
      })

      // Enrich items with missing brand/model/variant
      sale.items?.forEach((item: any) => {
        if (item.productId && (!item.brand && !item.model && !item.variant)) {
          const productInfo = productMap.get(item.productId.toString())
          if (productInfo) {
            item.brand = productInfo.brand
            item.model = productInfo.model
            item.variant = productInfo.variant
          }
        }
      })
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error('[sales/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch sale' }, { status: 500 })
  }
}
