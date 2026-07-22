// ─── GET /api/bar/products ────────────────────────────────────────────────────
// Returns all active bar inventory items with their brand info and servings
// embedded, ready for the Quick Sale and Tab product-selection UX.
//
// Shape of each item in the response:
// {
//   _id, size, buyingPrice, bottleSellingPrice, stock, lowStockThreshold,
//   brandId, brandName, brandCategory,
//   hasOpenBottle: boolean,
//   servings: [{ _id, name, unitsProduced, sellingPrice }]
// }
//
// Query params:
//   search   — fuzzy match on brandName or size (case-insensitive)
//   category — exact match on brand category (e.g. "Whiskey")

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const search   = searchParams.get('search')?.trim().toLowerCase() ?? ''
    const category = searchParams.get('category')?.trim() ?? ''

    // 1. Fetch all active inventory items for this owner
    const items = await models.BarInventoryItem.find({
      userId:   ownerId,
      isActive: true,
    }).lean()

    if (items.length === 0) return NextResponse.json({ products: [] })

    // 2. Batch-fetch all required brands, servings, and open bottles in parallel
    const brandIds = [...new Set(items.map((i: any) => String(i.brandId)))]
    const itemIds  = items.map((i: any) => i._id)

    const [brands, allServings, openBottles] = await Promise.all([
      models.BarBrand.find({ _id: { $in: brandIds } }).lean(),
      models.BarServing.find({ inventoryItemId: { $in: itemIds }, isActive: true })
        .sort({ unitsProduced: -1 })   // highest-unit serving first (Tot → Quarter → Half)
        .lean(),
      models.BarBottle.find({ inventoryItemId: { $in: itemIds }, state: 'open' }).lean(),
    ])

    // Build lookup maps
    const brandMap   = new Map(brands.map((b: any)   => [String(b._id), b]))
    const servingMap = new Map<string, any[]>()
    for (const s of allServings as any[]) {
      const key = String(s.inventoryItemId)
      if (!servingMap.has(key)) servingMap.set(key, [])
      servingMap.get(key)!.push(s)
    }
    const openBottleSet = new Set(openBottles.map((b: any) => String(b.inventoryItemId)))

    // 3. Compose and filter
    const products = (items as any[])
      .map(item => {
        const brand = brandMap.get(String(item.brandId))
        // name field was added later — fall back to brand name for older records
        const itemName = (item.name && item.name.trim()) ? item.name : (brand?.name ?? '')
        return {
          _id:               String(item._id),
          name:              itemName,
          size:              item.size,
          buyingPrice:       item.buyingPrice,
          bottleSellingPrice: item.bottleSellingPrice,
          stock:             item.stock,
          lowStockThreshold: item.lowStockThreshold,
          brandId:           String(item.brandId),
          brandName:         brand?.name         ?? '',
          brandCategory:     brand?.category     ?? '',
          hasOpenBottle:     openBottleSet.has(String(item._id)),
          servings:          (servingMap.get(String(item._id)) ?? []).map((s: any) => ({
            _id:           String(s._id),
            name:          s.name,
            unitsProduced: s.unitsProduced,
            sellingPrice:  s.sellingPrice,
          })),
        }
      })
      .filter(item => {
        // Category filter
        if (category && item.brandCategory.toLowerCase() !== category.toLowerCase()) return false
        // Search filter — match on item name, brand name, or size
        if (search) {
          const inName  = item.name.toLowerCase().includes(search)
          const inBrand = item.brandName.toLowerCase().includes(search)
          const inSize  = item.size.toLowerCase().includes(search)
          if (!inName && !inBrand && !inSize) return false
        }
        return true
      })
      // Sort: in-stock first, then alphabetically by brand name
      .sort((a, b) => {
        if (a.stock > 0 && b.stock === 0) return -1
        if (a.stock === 0 && b.stock > 0) return 1
        return a.brandName.localeCompare(b.brandName) || a.size.localeCompare(b.size)
      })

    // 4. Derive unique categories for the category filter bar in the UI
    const categories = [...new Set(
      (items as any[]).map(i => brandMap.get(String(i.brandId))?.category ?? '').filter(Boolean)
    )].sort()

    return NextResponse.json({ products, categories })
  } catch (error) {
    console.error('[bar/products] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bar products' }, { status: 500 })
  }
}
