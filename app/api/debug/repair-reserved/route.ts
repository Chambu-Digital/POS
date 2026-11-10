// Repair endpoint: recomputes the 'reserved' / 'quantityReserved' field on
// ProductInventory (and drug Inventory) from the actual pending stock
// transfers.
//
// Root cause being repaired: the receive route historically never cleared
// 'reserved' on the source branch, so it accumulated permanently after every
// received transfer. This endpoint recomputes the correct value:
//
//   reserved = sum of quantitySent for all PENDING (pending_receipt) transfers
//              where this branch is the source (fromBranchId)
//
// Usage (authenticated — resolves your tenant + branch from session):
//   GET  /api/debug/repair-reserved                  → dry run (preview in browser)
//   POST /api/debug/repair-reserved                  → dry run (preview)
//   POST /api/debug/repair-reserved  { "apply": true }  → apply the fix
//   ?branch=<id> to target a specific branch
//
// Safe to run repeatedly — it recomputes from first principles each time.

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'

async function runRepair(request: NextRequest, apply: boolean) {
  const payload = await getAuthPayload()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { models } = await getTenantDB(request)
  const ownerId =
    payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
  const { searchParams } = new URL(request.url)
  const branchOverride = searchParams.get('branch')?.trim()
  const branchContext = branchOverride || (await getBranchContext(request))

  if (!branchContext) {
    return NextResponse.json({ error: 'Branch context is required' }, { status: 400 })
  }

  // ── 1. Build the correct reserved map from pending transfers ────────────
  const pendingTransfers = (await models.StockTransfer.find({
    userId: ownerId,
    fromBranchId: branchContext,
    status: 'pending_receipt',
  }).lean()) as any[]

  const productReserved = new Map<string, number>()
  const drugReserved = new Map<string, number>()

  for (const transfer of pendingTransfers) {
    for (const item of transfer.items || []) {
      if (item.productId) {
        const key = String(item.productId)
        productReserved.set(key, (productReserved.get(key) || 0) + (item.quantitySent || 0))
      } else if (item.drugId) {
        const key = String(item.drugId)
        drugReserved.set(key, (drugReserved.get(key) || 0) + (item.quantitySent || 0))
      }
    }
  }

  // ── 2. Recompute reserved on ProductInventory ───────────────────────────
  const productInvs = (await models.ProductInventory.find({
    userId: ownerId,
    branchId: branchContext,
  }).lean()) as any[]

  const productChanges: any[] = []
  let productFixed = 0

  for (const inv of productInvs) {
    const pid = String(inv.productId)
    const correctReserved = productReserved.get(pid) || 0
    const currentReserved = inv.reserved || 0

    if (currentReserved !== correctReserved) {
      productChanges.push({
        inventoryId: String(inv._id),
        productId: pid,
        stock: inv.stock,
        reservedBefore: currentReserved,
        reservedAfter: correctReserved,
      })

      if (apply) {
        await models.ProductInventory.updateOne(
          { _id: inv._id },
          { $set: { reserved: correctReserved, lastUpdated: new Date() } },
        )
      }
      productFixed++
    }
  }

  // ── 3. Recompute quantityReserved on drug Inventory ──────────────────────
  const drugInvs = (await models.Inventory.find({
    userId: ownerId,
    branchId: branchContext,
  }).lean()) as any[]

  const drugChanges: any[] = []
  let drugFixed = 0

  for (const inv of drugInvs) {
    const did = String(inv.drugId)
    const correctReserved = drugReserved.get(did) || 0
    const currentReserved = inv.quantityReserved || 0

    if (currentReserved !== correctReserved) {
      drugChanges.push({
        inventoryId: String(inv._id),
        drugId: did,
        quantityAvailable: inv.quantityAvailable,
        reservedBefore: currentReserved,
        reservedAfter: correctReserved,
      })

      if (apply) {
        await models.Inventory.updateOne(
          { _id: inv._id },
          { $set: { quantityReserved: correctReserved, lastStockUpdate: new Date() } },
        )
      }
      drugFixed++
    }
  }

  return NextResponse.json({
    meta: {
      ownerId: String(ownerId),
      branchContext: String(branchContext),
      mode: apply ? 'APPLIED' : 'DRY_RUN',
      pendingTransfers: pendingTransfers.length,
      productsWithCorrectReserved: productInvs.length - productFixed,
      productsNeedingFix: productFixed,
      drugsNeedingFix: drugFixed,
    },
    productChanges: productChanges.slice(0, 500),
    productChangeCount: productChanges.length,
    drugChanges: drugChanges.slice(0, 500),
    drugChangeCount: drugChanges.length,
    message: apply
      ? `Repaired ${productFixed} product(s) and ${drugFixed} drug(s).`
      : `Dry run: ${productFixed} product(s) and ${drugFixed} drug(s) need repair. POST with { "apply": true } to fix.`,
  })
}

// GET — dry-run preview, openable directly in the browser
export async function GET(request: NextRequest) {
  try {
    return await runRepair(request, false)
  } catch (error: any) {
    console.error('[debug/repair-reserved] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to preview repair', details: String(error?.message || error) },
      { status: 500 },
    )
  }
}

// POST — dry run by default; apply with { "apply": true }
export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      /* no body is fine — defaults to dry run */
    }
    return await runRepair(request, body.apply === true)
  } catch (error: any) {
    console.error('[debug/repair-reserved] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to repair reserved counts', details: String(error?.message || error) },
      { status: 500 },
    )
  }
}
