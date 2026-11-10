// Restore endpoint: recreates missing product documents from stock transfer history.
//
// When a product document is deleted, its ProductInventory record (with stock count)
// remains as an orphan. This endpoint reconstructs the product document from:
//   1. The itemName stored in stock_transfers (format: "Brand › Variant › Model › ProductName")
//   2. The unitPrice stored in stock_transfers
//   3. The stock value from the orphaned ProductInventory record
//
// Usage (authenticated):
//   GET  /api/debug/restore-orphaned-products         → dry run, preview what would be restored
//   POST /api/debug/restore-orphaned-products         → dry run
//   POST /api/debug/restore-orphaned-products  { "apply": true }  → restore
//
// Only restores orphans with stock > 0 by default.
// Pass { "apply": true, "includeZeroStock": true } to also restore zero-stock orphans.
//
// Safe: uses upsert on the product _id, so safe to run multiple times.

import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'

function parseCompositeNameToProduct(itemName: string): {
  productName: string
  brand: string
  variant: string
  model: string
} {
  // itemName format: "Brand › Variant › Model › ProductName"
  // The last token is always productName; the rest fill brand/variant/model.
  const parts = itemName.split('›').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return { productName: itemName, brand: '', variant: '', model: '' }
  if (parts.length === 1) return { productName: parts[0], brand: '', variant: '', model: '' }
  if (parts.length === 2) return { productName: parts[1], brand: parts[0], variant: '', model: '' }
  if (parts.length === 3) return { productName: parts[2], brand: parts[0], variant: parts[1], model: '' }
  // 4+ parts: brand › variant › model › productName (use last as productName)
  return {
    productName: parts[parts.length - 1],
    brand: parts[0],
    variant: parts[1],
    model: parts.slice(2, parts.length - 1).join(' › '),
  }
}

async function run(request: NextRequest, apply: boolean, includeZeroStock: boolean) {
  const payload = await getAuthPayload()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { models, conn } = await getTenantDB(request)
  const ownerId =
    payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
  const branchContext = (new URL(request.url)).searchParams.get('branch')?.trim()
    || (await getBranchContext(request))

  if (!branchContext) {
    return NextResponse.json({ error: 'Branch context is required' }, { status: 400 })
  }

  // ── 1. Find orphaned inventory records ────────────────────────────────────
  const allInvs = (await models.ProductInventory.find({
    userId: ownerId,
    branchId: branchContext,
  }).lean()) as any[]

  const allProducts = (await models.Product.find({ userId: ownerId }, { _id: 1 }).lean()) as any[]
  const existingIds = new Set(allProducts.map((p: any) => String(p._id)))

  const orphans = allInvs.filter(
    (inv: any) =>
      !existingIds.has(String(inv.productId)) &&
      (includeZeroStock || (inv.stock || 0) > 0),
  )

  if (orphans.length === 0) {
    return NextResponse.json({
      meta: { mode: apply ? 'APPLIED' : 'DRY_RUN', orphansConsidered: 0 },
      message: 'No orphaned inventory records found matching criteria.',
      restored: [],
    })
  }

  // ── 2. Look up product names from transfer history ─────────────────────────
  const orphanProductIds = orphans.map((inv: any) => new mongoose.Types.ObjectId(String(inv.productId)))

  const transfers = (await models.StockTransfer.find({
    'items.productId': { $in: orphanProductIds },
  })
    .sort({ createdAt: -1 })
    .lean()) as any[]

  // Build a map: productId → best transfer item (most recent, with itemName + unitPrice)
  const transferItemMap = new Map<string, { itemName: string; unitPrice: number }>()
  for (const t of transfers) {
    for (const item of t.items || []) {
      if (!item.productId) continue
      const key = String(item.productId)
      if (!transferItemMap.has(key) && item.itemName) {
        transferItemMap.set(key, {
          itemName: item.itemName,
          unitPrice: item.unitPrice || 0,
        })
      }
    }
  }

  // ── 3. Reconstruct product documents ──────────────────────────────────────
  const restored: any[] = []
  const skipped: any[] = []

  for (const inv of orphans) {
    const pid = String(inv.productId)
    const transferItem = transferItemMap.get(pid)

    if (!transferItem) {
      // No transfer history — we can't infer the name
      skipped.push({ productId: pid, stock: inv.stock, reason: 'No transfer history found to infer product name' })
      continue
    }

    const { productName, brand, variant, model } = parseCompositeNameToProduct(transferItem.itemName)
    const sellingPrice = transferItem.unitPrice || 0

    const productDoc = {
      _id: new mongoose.Types.ObjectId(pid),
      userId: new mongoose.Types.ObjectId(String(ownerId)),
      productName,
      brand,
      variant,
      model,
      category: 'Restored',
      sellingPrice,
      buyingPrice: 0,
      stock: inv.stock || 0, // legacy field — actual stock lives in ProductInventory
      lowStockThreshold: 10,
      description: `Restored from transfer history. Original name: ${transferItem.itemName}`,
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    restored.push({
      productId: pid,
      inferredName: transferItem.itemName,
      parsed: { productName, brand, variant, model },
      sellingPrice,
      stock: inv.stock || 0,
      ...(apply ? { status: 'restored' } : { status: 'would_restore' }),
    })

    if (apply) {
      await conn.db.collection('products').updateOne(
        { _id: new mongoose.Types.ObjectId(pid) },
        { $setOnInsert: productDoc },
        { upsert: true },
      )
    }
  }

  return NextResponse.json({
    meta: {
      ownerId: String(ownerId),
      branchContext: String(branchContext),
      mode: apply ? 'APPLIED' : 'DRY_RUN',
      orphansConsidered: orphans.length,
      restoredCount: restored.length,
      skippedCount: skipped.length,
    },
    restored,
    skipped,
    message: apply
      ? `Restored ${restored.length} product(s). ${skipped.length} skipped (no transfer history). Check the inventory page — refresh it to see them. You'll need to set buying prices manually.`
      : `Dry run: ${restored.length} product(s) can be restored, ${skipped.length} cannot (no transfer history). POST with { "apply": true } to restore.`,
  })
}

export async function GET(request: NextRequest) {
  try {
    return await run(request, false, false)
  } catch (e: any) {
    console.error('[restore-orphaned-products] GET error:', e)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try { body = await request.json() } catch { /* no body */ }
    return await run(request, body.apply === true, body.includeZeroStock === true)
  } catch (e: any) {
    console.error('[restore-orphaned-products] POST error:', e)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
