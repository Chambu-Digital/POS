// ─── /api/debug/sync-product-stock ───────────────────────────────────────────
// Repairs Product.stock (global catalog field) so it matches the sum of all
// ProductInventory.stock records across every branch for each product.
//
// Root cause this fixes: stock-transfer receive/create routes previously never
// touched Product.stock — only ProductInventory. So after a transfer the branch
// view (which reads ProductInventory) is correct, but the global field and the
// owner catalog view stay stale.
//
// Usage (authenticated — resolves your tenant from session):
//   GET  /api/debug/sync-product-stock             → dry run, see what would change
//   POST /api/debug/sync-product-stock             → dry run
//   POST /api/debug/sync-product-stock  { "apply": true }  → apply the fix
//   ?productId=<id>  to target a single product

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { Types } from 'mongoose'

async function runSync(request: NextRequest, apply: boolean) {
  const payload = await getAuthPayload()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { models } = await getTenantDB(request)
  const ownerId =
    payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

  const { searchParams } = new URL(request.url)
  const productIdParam = searchParams.get('productId')?.trim()

  // ── 1. Aggregate ProductInventory: sum stock per product across all branches
  const matchStage: any = { userId: new Types.ObjectId(ownerId) }
  if (productIdParam) matchStage.productId = new Types.ObjectId(productIdParam)

  const aggregated = (await models.ProductInventory.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$productId',
        totalStock: { $sum: '$stock' },
        branchCount: { $sum: 1 },
        branches: { $push: { branchId: '$branchId', stock: '$stock' } },
      },
    },
  ])) as Array<{
    _id: Types.ObjectId
    totalStock: number
    branchCount: number
    branches: Array<{ branchId: Types.ObjectId; stock: number }>
  }>

  // ── 2. Load the matching Product documents
  const productIds = aggregated.map((a) => a._id)
  const productQuery: any = { userId: ownerId, _id: { $in: productIds } }
  const products = (await models.Product.find(productQuery)
    .select('_id productName brand model variant stock')
    .lean()) as Array<{
    _id: Types.ObjectId
    productName: string
    brand?: string
    model?: string
    variant?: string
    stock: number
  }>

  const productMap = new Map(products.map((p) => [String(p._id), p]))

  // ── 3. Diff and optionally apply
  const changes: any[] = []
  const skipped: any[] = []
  let fixedCount = 0

  for (const agg of aggregated) {
    const pid = String(agg._id)
    const product = productMap.get(pid)

    if (!product) {
      skipped.push({ productId: pid, reason: 'Product document not found (orphaned inventory)' })
      continue
    }

    const currentGlobal = product.stock ?? 0
    const correctGlobal = agg.totalStock

    if (currentGlobal === correctGlobal) continue // already in sync

    const displayName = [product.brand, product.model, product.variant, product.productName]
      .filter(Boolean)
      .join(' › ')

    changes.push({
      productId: pid,
      name: displayName,
      stockBefore: currentGlobal,
      stockAfter: correctGlobal,
      delta: correctGlobal - currentGlobal,
      branchCount: agg.branchCount,
      branches: agg.branches.map((b) => ({
        branchId: String(b.branchId),
        stock: b.stock,
      })),
    })

    if (apply) {
      await models.Product.findByIdAndUpdate(agg._id, {
        stock: correctGlobal,
        updatedAt: new Date(),
      })
      fixedCount++
    }
  }

  return NextResponse.json({
    meta: {
      ownerId: String(ownerId),
      mode: apply ? 'APPLIED' : 'DRY_RUN',
      productIdFilter: productIdParam || null,
      productsScanned: aggregated.length,
      productsOutOfSync: changes.length,
      productsFixed: apply ? fixedCount : 0,
      orphanedInventoryRecords: skipped.length,
    },
    changes,
    skipped,
    message: apply
      ? `Fixed ${fixedCount} product(s). Product.stock now matches sum of all branch inventories.`
      : `Dry run: ${changes.length} product(s) out of sync. POST with { "apply": true } to fix.`,
  })
}

// GET — dry run, safe to open in browser
export async function GET(request: NextRequest) {
  try {
    return await runSync(request, false)
  } catch (error: any) {
    console.error('[debug/sync-product-stock] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to scan', details: String(error?.message || error) },
      { status: 500 }
    )
  }
}

// POST — apply with { "apply": true }, otherwise dry run
export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try { body = await request.json() } catch { /* no body → dry run */ }
    return await runSync(request, body.apply === true)
  } catch (error: any) {
    console.error('[debug/sync-product-stock] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to sync', details: String(error?.message || error) },
      { status: 500 }
    )
  }
}
