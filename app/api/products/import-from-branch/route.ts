import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

// GET - Fetch products available for import from a source branch
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { searchParams } = new URL(request.url)
    const sourceBranchId = searchParams.get('sourceBranchId')

    if (!sourceBranchId) {
      return NextResponse.json({ error: 'sourceBranchId is required' }, { status: 400 })
    }

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Verify source branch exists and belongs to user
    const sourceBranch = await models.Branch.findOne({ 
      _id: sourceBranchId, 
      userId: ownerId 
    })

    if (!sourceBranch) {
      return NextResponse.json({ error: 'Source branch not found' }, { status: 404 })
    }

    // Get all products in catalog
    const products = await models.Product.find({ userId: ownerId }).lean()

    // Get inventory for source branch (for reference only)
    const inventories = await models.ProductInventory.find({
      userId: ownerId,
      branchId: sourceBranchId,
    }).lean()

    const inventoryMap = new Map(inventories.map(inv => [inv.productId.toString(), inv]))

    // Merge stock info from source branch (for display purposes only)
    const productsWithStock = products.map((product: any) => {
      const inventory = inventoryMap.get(product._id.toString())
      return {
        ...product,
        sourceStock: inventory?.stock || 0, // Stock in source branch (reference only)
      }
    })

    return NextResponse.json({ 
      products: productsWithStock,
      sourceBranch: {
        id: sourceBranch._id,
        name: sourceBranch.name,
        code: sourceBranch.code,
      }
    })
  } catch (error) {
    console.error('[products/import-from-branch] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// POST - Import selected products with initial quantities
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const body = await request.json()
    const { sourceBranchId, items } = body

    if (!sourceBranchId || !items || !Array.isArray(items)) {
      return NextResponse.json({ 
        error: 'sourceBranchId and items array are required' 
      }, { status: 400 })
    }

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const targetBranchId = await getBranchContext(request)

    if (!targetBranchId) {
      return NextResponse.json({ 
        error: 'Branch context required. Please select a branch first.' 
      }, { status: 400 })
    }

    // Verify source and target branches
    const [sourceBranch, targetBranch] = await Promise.all([
      models.Branch.findOne({ _id: sourceBranchId, userId: ownerId }),
      models.Branch.findOne({ _id: targetBranchId, userId: ownerId }),
    ])

    if (!sourceBranch) {
      return NextResponse.json({ error: 'Source branch not found' }, { status: 404 })
    }

    if (!targetBranch) {
      return NextResponse.json({ error: 'Target branch not found' }, { status: 404 })
    }

    if (sourceBranchId === targetBranchId) {
      return NextResponse.json({ 
        error: 'Cannot import from the same branch' 
      }, { status: 400 })
    }

    // Validate items format
    const invalidItems = items.filter(item => 
      !item.productId || 
      typeof item.initialQuantity !== 'number' || 
      item.initialQuantity < 0
    )

    if (invalidItems.length > 0) {
      return NextResponse.json({ 
        error: 'Each item must have productId and non-negative initialQuantity' 
      }, { status: 400 })
    }

    // Verify all products exist and belong to user
    const productIds = items.map(item => item.productId)
    const products = await models.Product.find({ 
      _id: { $in: productIds }, 
      userId: ownerId 
    })

    if (products.length !== productIds.length) {
      return NextResponse.json({ 
        error: 'One or more products not found' 
      }, { status: 404 })
    }

    // Check for existing inventory records in target branch
    const existingInventories = await models.ProductInventory.find({
      userId: ownerId,
      branchId: targetBranchId,
      productId: { $in: productIds }
    }).lean()

    const existingProductIds = new Set(
      existingInventories.map(inv => inv.productId.toString())
    )

    // Create inventory records for products not already in target branch
    const inventoryRecords = items
      .filter(item => !existingProductIds.has(item.productId))
      .map(item => ({
        userId: ownerId,
        branchId: targetBranchId,
        productId: item.productId,
        stock: item.initialQuantity,
        reserved: 0,
        lastUpdated: new Date(),
        createdAt: new Date(),
      }))

    let importedCount = 0
    let skippedCount = existingProductIds.size

    if (inventoryRecords.length > 0) {
      await models.ProductInventory.insertMany(inventoryRecords)
      importedCount = inventoryRecords.length
    }

    return NextResponse.json({ 
      success: true,
      message: `Imported ${importedCount} products. Skipped ${skippedCount} already existing.`,
      imported: importedCount,
      skipped: skippedCount,
      targetBranch: {
        id: targetBranch._id,
        name: targetBranch.name,
        code: targetBranch.code,
      }
    }, { status: 201 })

  } catch (error) {
    console.error('[products/import-from-branch] POST error:', error)
    return NextResponse.json({ error: 'Failed to import products' }, { status: 500 })
  }
}
