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
    const brandId = searchParams.get('brandId')
    const lowStock = searchParams.get('lowStock')
    const branchId = searchParams.get('branchId')

    const filter: Record<string, unknown> = { userId: ownerId, isActive: true }

    if (brandId) {
      filter.brandId = new Types.ObjectId(brandId)
    }

    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] }
    }

    if (branchId) {
      filter.branchId = new Types.ObjectId(branchId)
    }

    const rawItems = await models.BarInventoryItem.find(filter).lean()

    const items = await Promise.all(
      rawItems.map(async (item: any) => {
        const brand = await models.BarBrand.findById(item.brandId).lean() as any
        const openBottle = await models.BarBottle.findOne({
          inventoryItemId: item._id,
          state: 'open',
        }).lean()

        return {
          ...item,
          brandName: brand?.name ?? '',
          openBottle: openBottle ?? null,
          lowStockAlert: item.stock <= item.lowStockThreshold,
        }
      })
    )

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[bar/inventory-items]', error)
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

    const brand = await models.BarBrand.findOne({
      _id: new Types.ObjectId(brandId),
      userId: ownerId,
    })
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const item = new models.BarInventoryItem({
      userId: ownerId,
      brandId,
      name:   name ?? '',
      size,
      buyingPrice,
      bottleSellingPrice,
      stock: stock ?? 0,
      lowStockThreshold: lowStockThreshold ?? 3,
      isActive: true,
      branchId: branchId ?? undefined,
    })
    await item.save()

    await models.BarAuditLog.create({
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : ownerId,
      branchId: branchId ?? undefined,
      operation: 'INVENTORY_ADJUSTED',
      referenceId: String(item._id),
      referenceType: 'BarInventoryItem',
      details: {
        action: 'created',
        size,
        buyingPrice,
        bottleSellingPrice,
        stock: item.stock,
        lowStockThreshold: item.lowStockThreshold,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('[bar/inventory-items]', error)
    return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 })
  }
}
