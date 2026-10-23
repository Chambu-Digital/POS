import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    let query: any = { userId: ownerId }
    if (category && category !== 'all') query.category = category
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ]
    }

    // Branch-specific inventory: only show products that exist in this branch
    if (branchContext) {
      // Get ProductInventory records for this branch
      const inventories = await models.ProductInventory.find({
        userId: ownerId,
        branchId: branchContext,
      }).lean()

      if (inventories.length === 0) {
        return NextResponse.json({ products: [] })
      }

      // Get product IDs that exist in this branch's inventory
      const branchProductIds = inventories.map(inv => inv.productId)
      
      // Add productId filter to query
      query._id = { $in: branchProductIds }

      const products = await models.Product.find(query).sort({ createdAt: -1 }).lean()

      // Map inventory data to products
      const inventoryMap = new Map(inventories.map(inv => [inv.productId.toString(), inv]))

      products.forEach((product: any) => {
        const inventory = inventoryMap.get(product._id.toString())
        product.stock = inventory?.stock || 0
        product.reserved = inventory?.reserved || 0
      })

      return NextResponse.json({ products })
    }

    // No branch context: return all products (catalog view for owner)
    const products = await models.Product.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ products })
  } catch (error) {
    console.error('[products] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    // Clean empty strings for ObjectId fields (convert to undefined)
    const cleanedData = { ...data }
    if (cleanedData.supplierId === '') delete cleanedData.supplierId
    if (cleanedData.categoryId === '') delete cleanedData.categoryId
    if (cleanedData.branchId === '') delete cleanedData.branchId

    // ── Duplicate detection ───────────────────────────────────────────────────
    // A product is considered a duplicate when userId + productName + brand +
    // model + variant all match an existing record (case-insensitive on name,
    // exact match on brand/model/variant since they are identifiers).
    // Empty/undefined fields are treated as empty string for comparison.
    if (cleanedData.productName) {
      const dupQuery: any = {
        userId:      ownerId,
        productName: { $regex: `^${cleanedData.productName.trim()}$`, $options: 'i' },
        brand:       cleanedData.brand   || '',
        model:       cleanedData.model   || '',
        variant:     cleanedData.variant || '',
      }

      const existing = await models.Product.findOne(dupQuery).lean() as any
      if (existing) {
        return NextResponse.json(
          {
            error:      'Duplicate item detected',
            duplicate:  true,
            existingId: existing._id.toString(),
          },
          { status: 409 }
        )
      }
    }

    // Create product catalog entry (stock field is deprecated but kept for backward compatibility)
    const product = new models.Product({ 
      ...cleanedData, 
      userId: ownerId,
      stock: cleanedData.stock || 0,  // Keep for backward compatibility
    })
    await product.save()

    // If creating from a branch context, also create ProductInventory record
    if (branchContext) {
      await models.ProductInventory.create({
        userId: ownerId,
        branchId: branchContext,
        productId: product._id,
        stock: cleanedData.stock || 0,
        reserved: 0,
        lastUpdated: new Date(),
      })
      console.log(`[products] Created ProductInventory for product ${product._id} in branch ${branchContext}`)
    }

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[products] POST error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
