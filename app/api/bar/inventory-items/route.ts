import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const brandId   = searchParams.get('brandId')
    const lowStock  = searchParams.get('lowStock')
    const outStock  = searchParams.get('outStock')
    const branchId  = searchParams.get('branchId')

    const filter: Record<string, unknown> = { userId: ownerId, isActive: true }
    if (brandId)  filter.brandId  = new Types.ObjectId(brandId)
    if (branchId) filter.branchId = new Types.ObjectId(branchId)
    if (lowStock === 'true') {
      // items where stock > 0 AND stock <= lowStockThreshold
      filter.$and = [
        { stock: { $gt: 0 } },
        { $expr: { $lte: ['$stock', '$lowStockThreshold'] } },
      ]
    }
    if (outStock === 'true') {
      filter.stock = 0
    }

    const rawItems = await models.BarInventoryItem.find(filter).lean() as any[]

    if (rawItems.length === 0) return NextResponse.json({ items: [] })

    // ── Batch-fetch brands and open bottles (no N+1) ──────────────────────────
    const brandIds = [...new Set(rawItems.map(i => String(i.brandId)))]
    const itemIds  = rawItems.map(i => i._id)

    const [brands, openBottles, servingCounts] = await Promise.all([
      models.BarBrand.find({ _id: { $in: brandIds } }).lean() as Promise<any[]>,
      models.BarBottle.find({ inventoryItemId: { $in: itemIds }, state: 'open' }).lean() as Promise<any[]>,
      models.BarServing.aggregate([
        { $match: { inventoryItemId: { $in: itemIds }, isActive: true } },
        { $group: { _id: '$inventoryItemId', count: { $sum: 1 } } },
      ]),
    ])

    const brandMap        = new Map(brands.map((b: any)  => [String(b._id), b]))
    const openBottleMap   = new Map(openBottles.map((b: any) => [String(b.inventoryItemId), b]))
    const servingCountMap = new Map(servingCounts.map((s: any) => [String(s._id), s.count]))

    const items = rawItems.map(item => {
      const brand      = brandMap.get(String(item.brandId))
      const openBottle = openBottleMap.get(String(item._id)) ?? null
      const servings   = servingCountMap.get(String(item._id)) ?? 0

      return {
        _id:               String(item._id),
        // name is the specific product label (e.g. "Jameson") set on the item itself.
        // Fall back to brand name for older records created before the field existed.
        name:              item.name || brand?.name || '',
        size:              item.size,
        buyingPrice:       item.buyingPrice,
        bottleSellingPrice: item.bottleSellingPrice,
        stock:             item.stock,
        lowStockThreshold: item.lowStockThreshold,
        isActive:          item.isActive,
        // Brand fields — flat for easy access on the list page
        brandId:           String(item.brandId),
        brandName:         brand?.name     ?? '',
        brandCategory:     brand?.category ?? '',
        // Open bottle summary
        openBottle:        openBottle ? {
          _id:            String(openBottle._id),
          state:          openBottle.state,
          remainingUnits: openBottle.remainingUnits,
        } : null,
        // Serving count for the list view badge
        servingCount:      servings,
        lowStockAlert:     item.stock > 0 && item.stock <= item.lowStockThreshold,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[bar/inventory-items GET]', error)
    return NextResponse.json({ error: 'Failed to fetch inventory items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const body = await request.json()
    const { brandId, name, size, buyingPrice, bottleSellingPrice, stock, lowStockThreshold, branchId } = body

    if (!brandId || !size || buyingPrice === undefined || bottleSellingPrice === undefined || stock === undefined) {
      return NextResponse.json(
        { error: 'brandId, size, buyingPrice, bottleSellingPrice, and stock are required' },
        { status: 400 }
      )
    }

    const brand = await models.BarBrand.findOne({ _id: new Types.ObjectId(brandId), userId: ownerId })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    const item = new models.BarInventoryItem({
      userId:             ownerId,
      brandId,
      name:               name ?? '',
      size,
      buyingPrice,
      bottleSellingPrice,
      stock:              stock ?? 0,
      lowStockThreshold:  lowStockThreshold ?? 3,
      isActive:           true,
      branchId:           branchId ?? undefined,
    })
    await item.save()

    await models.BarAuditLog.create({
      userId:        ownerId,
      staffId:       payload.type === 'staff' ? payload.userId : ownerId,
      operation:     'INVENTORY_ADJUSTED',
      referenceId:   String(item._id),
      referenceType: 'BarInventoryItem',
      details: { action: 'created', name, size, buyingPrice, bottleSellingPrice, stock },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('[bar/inventory-items POST]', error)
    return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 })
  }
}
