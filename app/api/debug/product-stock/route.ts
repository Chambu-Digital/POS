// Debug endpoint: diagnose the "Available: 6 in UI, but backend says Available: 1" bug.
//
// Authenticated — resolves your tenant + branch from your session, so it inspects
// exactly the data the stock-transfers API would reserve against.
//
// Usage (open in browser while logged in):
//   GET /api/debug/product-stock                       → scan current branch for anomalies
//   GET /api/debug/product-stock?search=18w%20bulb     → deep-dive products matching the term
//   GET /api/debug/product-stock?id=<productId>        → deep-dive one product
//   GET /api/debug/product-stock?branch=<branchId>     → override branch
//
// Distinguishes two root causes:
//   A) DUPLICATE product_inventory docs for the same (userId, branchId, productId):
//      the products API keeps the LAST doc in its Map, reserveInventory's findOne returns
//      the FIRST → UI shows one number, backend reserves against another.
//   B) ORPHANED reserved count: a single doc with stock=6, reserved=5 (available=1) but no
//      live transfer holds it (a transfer was deleted without releaseReservation).

import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'

function compositeName(p: any): string {
  return [p.brand, p.variant, p.model, p.productName].filter(Boolean).join(' › ')
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const ownerId =
      payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')?.trim()
    const idParam = searchParams.get('id')?.trim()
    const branchOverride = searchParams.get('branch')?.trim()
    const branchContext = branchOverride || (await getBranchContext(request))

    // strip non-alphanumerics so stray quotes/punctuation (e.g. "bulb\"") don't break matching
    const tokens = search
      ? search
          .toLowerCase()
          .split(/\s+/)
          .map((t) => t.replace(/[^a-z0-9]/g, ''))
          .filter(Boolean)
      : []

    // ── unique index status on product_inventory ──────────────────────────────
    let uniqueIndex: { present: boolean; detail: any } = { present: false, detail: null }
    try {
      const indexes: any[] = await conn.db.collection('product_inventory').indexes()
      const found = indexes.find(
        (ix) =>
          ix.unique === true &&
          JSON.stringify(ix.key) === JSON.stringify({ userId: 1, branchId: 1, productId: 1 }),
      )
      uniqueIndex = { present: !!found, detail: found || null }
    } catch (e) {
      uniqueIndex = { present: false, detail: 'could not read indexes' }
    }

    const branchMap = new Map<string, any>()
    const branches = (await models.Branch.find({ userId: ownerId }).lean()) as any[]
    branches.forEach((b) => branchMap.set(String(b._id), b))
    const branchLabel = (bid: any) => {
      const b = branchMap.get(String(bid))
      return b ? `${b.name}${b.code ? ` (${b.code})` : ''}` : String(bid)
    }

    // ── resolve target products ──────────────────────────────────────────────
    let products: any[] = []
    if (idParam) {
      // Search without userId filter so we can detect ownership mismatches
      products = (await models.Product.find({ _id: new mongoose.Types.ObjectId(idParam) }).lean()) as any[]
      if (products.length === 0) {
        const raw = await conn.db.collection('products').findOne({ _id: new mongoose.Types.ObjectId(idParam) })
        return NextResponse.json({
          meta: { ownerId: String(ownerId), branchContext: branchContext ? String(branchContext) : null, mode: 'id_lookup' },
          result: raw
            ? { found: true, userId: String(raw.userId), matchesOwner: String(raw.userId) === String(ownerId), productName: raw.productName, brand: raw.brand, model: raw.model }
            : { found: false, message: 'Product document does not exist in the products collection at all' }
        })
      }
    } else if (searchParams.get('orphans') === 'true') {
      // Find ProductInventory records with no matching product document
      const allInvs = (await models.ProductInventory.find({
        userId: ownerId,
        branchId: branchContext,
      }).lean()) as any[]

      const allProducts = (await models.Product.find({ userId: ownerId }).lean()) as any[]
      const productIdSet = new Set(allProducts.map((p: any) => String(p._id)))

      const orphans = allInvs
        .filter((inv: any) => !productIdSet.has(String(inv.productId)))
        .map((inv: any) => ({
          inventoryId: String(inv._id),
          productId: String(inv.productId),
          stock: inv.stock,
          reserved: inv.reserved || 0,
          lastUpdated: inv.lastUpdated,
        }))

      return NextResponse.json({
        meta: {
          ownerId: String(ownerId),
          branchContext: branchContext ? String(branchContext) : null,
          branchLabel: branchContext ? branchLabel(branchContext) : null,
          mode: 'orphan_scan',
          totalInventoryDocs: allInvs.length,
          totalProductDocs: allProducts.length,
          orphanCount: orphans.length,
        },
        orphans,
        message: orphans.length === 0
          ? 'No orphaned inventory records found — all products are intact.'
          : `${orphans.length} ProductInventory records have no matching product document. These products were deleted but their stock records remain.`,
      })
    } else if (search) {
      const all = (await models.Product.find({ userId: ownerId }).lean()) as any[]
      products = all.filter((p) => tokens.every((t) => compositeName(p).toLowerCase().includes(t)))
    } else {
      // Anomaly scan: products that have a product_inventory doc in the current branch.
      const invDocs = (await models.ProductInventory.find({
        userId: ownerId,
        branchId: branchContext,
      }).lean()) as any[]
      const pids = Array.from(new Set(invDocs.map((d) => String(d.productId))))
      products = (await models.Product.find({
        _id: { $in: pids.map((p) => new mongoose.Types.ObjectId(p)) },
      }).lean()) as any[]
    }

    const isDeepDive = !!(idParam || search)

    // ── build per-product report ─────────────────────────────────────────────
    const report = await Promise.all(
      products.map(async (p) => {
        // In scan mode: only look at the current branch's inventory doc.
        // In deep dive: show all branches so you can see the full picture.
        const invFilter: any = { userId: ownerId, productId: p._id }
        if (!isDeepDive) invFilter.branchId = branchContext
        const allInvs = (await models.ProductInventory.find(invFilter).sort({ _id: 1 }).lean()) as any[]
        // For duplicate detection, only count docs for the SAME branch — one doc per branch is correct.
        const branchInvs = allInvs.filter((i: any) => String(i.branchId) === String(branchContext))
        const invs = isDeepDive ? allInvs : branchInvs

        const transfers = (await models.StockTransfer.find({
          'items.productId': p._id,
        })
          .sort({ createdAt: -1 })
          .lean()) as any[]

        const pendingTransfers = transfers.filter((t) => t.status === 'pending_receipt')
        const totalReservedAcrossDocs = invs.reduce((s, i) => s + (i.reserved ?? 0), 0)

        let verdict = 'ok'
        let verdictMessage = 'No issue detected.'
        // Always base the verdict on the current-branch docs only
        if (branchInvs.length === 0) {
          verdict = 'no_inventory'
          verdictMessage =
            'No product_inventory doc — backend reserveInventory would throw "Inventory not found".'
        } else if (branchInvs.length > 1) {
          verdict = 'duplicate_docs'
          verdictMessage = `DUPLICATE inventory docs for this branch (${branchInvs.length}). products API keeps the LAST doc; reserveInventory findOne returns the FIRST. UI and backend read different rows.`
        } else {
          const reserved = branchInvs[0].reserved ?? 0
          if (reserved > 0) {
            verdict = pendingTransfers.length === 0 ? 'orphaned_reserved' : 'reserved_with_transfers'
            verdictMessage =
              `Single doc: stock=${branchInvs[0].stock ?? 0}, reserved=${reserved}, available=${(branchInvs[0].stock ?? 0) - reserved}. ` +
              (pendingTransfers.length === 0
                ? 'No live pending transfer holds it → reserved count is stuck/orphaned.'
                : `${pendingTransfers.length} pending transfer(s) reference it — check whether their qty accounts for the reserved amount.`)
          }
        }

        return {
          product: {
            _id: String(p._id),
            name: compositeName(p),
            sku: p.sku ?? null,
            legacyProductStock: p.stock ?? null,
          },
          inventoryDocs: invs.map((i) => ({
            _id: String(i._id),
            branchId: String(i.branchId),
            branch: branchLabel(i.branchId),
            stock: i.stock ?? 0,
            reserved: i.reserved ?? 0,
            available: (i.stock ?? 0) - (i.reserved ?? 0),
            lastUpdated: i.lastUpdated ?? null,
          })),
          inventoryDocCount: invs.length,
          totalReserved: totalReservedAcrossDocs,
          transfers: transfers.slice(0, 25).map((t) => {
            const item = (t.items || []).find((it: any) => String(it.productId) === String(p._id))
            return {
              transferNumber: t.transferNumber,
              status: t.status,
              fromBranch: branchLabel(t.fromBranchId),
              toBranch: branchLabel(t.toBranchId),
              quantitySent: item?.quantitySent ?? null,
              createdAt: t.createdAt ?? null,
            }
          }),
          transferCount: transfers.length,
          pendingTransferCount: pendingTransfers.length,
          verdict,
          verdictMessage,
        }
      }),
    )

    // ── anomaly-scan mode: surface only flagged products at the top ───────────
    const flagged = report.filter(
      (r) =>
        r.verdict === 'duplicate_docs' ||
        r.verdict === 'orphaned_reserved' ||
        r.verdict === 'reserved_with_transfers' ||
        r.verdict === 'no_inventory',
    )

    // In scan mode the full list can be large; only return flagged products so the
    // response stays small enough to paste back. Deep-dive returns all matches.
    const productsOut = isDeepDive ? report : flagged

    return NextResponse.json({
      meta: {
        ownerId: String(ownerId),
        branchContext: branchContext ? String(branchContext) : null,
        branchLabel: branchContext ? branchLabel(branchContext) : null,
        mode: isDeepDive ? 'deep_dive' : 'anomaly_scan',
        search,
        productId: idParam || null,
        productCount: products.length,
        flaggedCount: flagged.length,
        uniqueIndex: uniqueIndex,
      },
      // in scan mode, flagged products only; in deep-dive, all matches
      flagged,
      products: productsOut,
    })
  } catch (error: any) {
    console.error('[debug/product-stock] Error:', error)
    return NextResponse.json(
      { error: 'Failed to inspect product stock', details: String(error?.message || error) },
      { status: 500 },
    )
  }
}
