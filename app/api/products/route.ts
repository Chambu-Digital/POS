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

    // Create product catalog entry (stock field is deprecated but kept for backward compatibility)
    const product = new models.Product({ 
      ...data, 
      userId: ownerId,
      stock: data.stock || 0,  // Keep for backward compatibility
    })
    await product.save()

    // NOTE: ProductInventory records are NOT created automatically
    // Branch managers must explicitly import products using the import endpoint
    // This prevents automatic stock inheritance and allows optional per-branch setup

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[products] POST error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
