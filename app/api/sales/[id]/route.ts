import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ─── GET /api/sales/[id] ──────────────────────────────────────────────────────
// Fetch sale details with populated product and customer information

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { id } = await params
    const saleId = new Types.ObjectId(id)
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })
      .populate('customerId', 'name phone email')
      .populate('returns.returnedBy', 'name')
      .lean()

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Manually populate staffId with proper name handling
    if (sale.staffId) {
      const staff = await conn.db.collection('staff').findOne({ _id: sale.staffId }) as any
      if (staff) {
        const staffName = staff.firstName && staff.lastName 
          ? `${staff.firstName} ${staff.lastName}`.trim()
          : staff.name || staff.email || 'Unknown Staff'
        
        sale.staffId = {
          _id: staff._id,
          name: staffName,
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
        } as any
      }
    } else {
      // No staffId means owner made the sale - fetch owner info
      const owner = await conn.db.collection('users').findOne({ _id: new Types.ObjectId(ownerId) }) as any
      if (owner) {
        const ownerName = owner.firstName && owner.lastName
          ? `${owner.firstName} ${owner.lastName}`.trim()
          : owner.shopName || owner.name || owner.email || 'Owner'
        
        sale.staffId = {
          _id: owner._id,
          name: ownerName,
          firstName: owner.firstName,
          lastName: owner.lastName,
          email: owner.email,
          isOwner: true,
        } as any
      }
    }

    // ── Backfill missing brand/model/variant for old orders ──────────────────
    // Collect productIds from items that are missing these fields
    const productIdsToLookup = new Set<string>()
    sale.items?.forEach((item: any) => {
      if (item.productId && (!item.brand && !item.model && !item.variant)) {
        productIdsToLookup.add(item.productId.toString())
      }
    })

    // Fetch product details if needed
    if (productIdsToLookup.size > 0) {
      const products = await conn.db.collection('products')
        .find({ _id: { $in: Array.from(productIdsToLookup).map(id => new Types.ObjectId(id)) } })
        .project({ _id: 1, brand: 1, model: 1, variant: 1 })
        .toArray()

      const productMap = new Map()
      products.forEach((p: any) => {
        productMap.set(p._id.toString(), {
          brand: p.brand || '',
          model: p.model || '',
          variant: p.variant || '',
        })
      })

      // Enrich items with missing brand/model/variant
      sale.items?.forEach((item: any) => {
        if (item.productId && (!item.brand && !item.model && !item.variant)) {
          const productInfo = productMap.get(item.productId.toString())
          if (productInfo) {
            item.brand = productInfo.brand
            item.model = productInfo.model
            item.variant = productInfo.variant
          }
        }
      })
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error('[sales/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch sale' }, { status: 500 })
  }
}

// ─── DELETE /api/sales/[id] ───────────────────────────────────────────────────
// Soft-deletes (voids) a sale.
//
// What this does:
//   1. Pre-checks  — auth, ownership, not already voided, no approved/pending returns
//   2. Stock       — reverses ProductInventory + Product.stock for every line item;
//                    restores ProductBatch quantities for lot-tracked items;
//                    writes a compensating ADJUSTMENT StockLedger entry per item
//   3. Customer    — if sale had debt, reverses creditBalance + pushes adjustment
//                    ledger entry; if deposit payments existed, restores deposit balance
//   4. Mark void   — sets status='voided', voidedAt, voidedBy, voidReason
//
// Permission: owner always allowed; staff must have canDeleteOrders === true.

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Permission check ──────────────────────────────────────────────────────
    if (payload.type === 'staff') {
      const perms = payload.permissions || {}
      const canDelete =
        perms['canDeleteOrders'] === true ||   // legacy direct field
        perms['pos.orders.delete'] === true     // future feature-key form
      if (!canDelete) {
        return NextResponse.json(
          { error: 'You do not have permission to void orders.' },
          { status: 403 }
        )
      }
    }

    const { models } = await getTenantDB(request)
    const branchContext = await getBranchContext(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null

    const { id } = await params

    // ── Parse body ────────────────────────────────────────────────────────────
    let voidReason = ''
    try {
      const body = await request.json()
      voidReason = (body?.reason || '').trim()
    } catch {
      // no-op — empty body is handled below
    }
    if (!voidReason) {
      return NextResponse.json({ error: 'A void reason is required.' }, { status: 400 })
    }

    // ── Fetch sale ────────────────────────────────────────────────────────────
    const saleId = new Types.ObjectId(id)
    const sale = await models.Sale.findOne({ _id: saleId, userId: ownerId })
    if (!sale) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    // ── Pre-checks ────────────────────────────────────────────────────────────
    if (sale.voidedAt) {
      return NextResponse.json({ error: 'This order has already been voided.' }, { status: 409 })
    }

    const hasApprovedReturn  = sale.returns?.some((r: any) => r.status === 'approved')
    const hasPendingReturn   = sale.returns?.some((r: any) => r.status === 'pending')
    const hasApprovedExchange = sale.exchanges?.some((e: any) => e.status === 'approved')

    if (hasApprovedReturn) {
      return NextResponse.json(
        { error: 'Cannot void an order that has approved returns. Reverse the returns first.' },
        { status: 409 }
      )
    }
    if (hasPendingReturn) {
      return NextResponse.json(
        { error: 'Cannot void an order with pending return requests. Approve or reject them first.' },
        { status: 409 }
      )
    }
    if (hasApprovedExchange) {
      return NextResponse.json(
        { error: 'Cannot void an order that has approved exchanges. Reverse the exchanges first.' },
        { status: 409 }
      )
    }

    // ── A. Stock reversal ─────────────────────────────────────────────────────
    const effectiveBranch = sale.branchId?.toString() || branchContext || null

    for (const item of sale.items || []) {
      if (!item.productId) continue  // free-text / service line items — no stock

      try {
        const productObjId = new Types.ObjectId(item.productId.toString())
        let previousStock = 0
        let newStock = 0

        if (effectiveBranch) {
          // Multi-branch path: restore ProductInventory + legacy Product.stock
          const inventory = await models.ProductInventory.findOne({
            userId:    ownerId,
            branchId:  effectiveBranch,
            productId: productObjId,
          })

          if (inventory) {
            previousStock        = inventory.stock ?? 0
            newStock             = previousStock + item.quantity
            inventory.stock      = newStock
            inventory.lastUpdated = new Date()
            await inventory.save()
          }

          await models.Product.findByIdAndUpdate(
            productObjId,
            { $inc: { stock: item.quantity }, updatedAt: new Date() }
          )
        } else {
          // Legacy single-branch path: restore Product.stock only
          const product = await models.Product.findById(productObjId).select('stock').lean() as any
          if (product) {
            previousStock = product.stock ?? 0
            newStock      = previousStock + item.quantity
            await models.Product.findByIdAndUpdate(
              productObjId,
              { $inc: { stock: item.quantity }, updatedAt: new Date() }
            )
          }
        }

        // Restore lot / batch quantities if the sale line had a batchId
        if (item.batchId) {
          try {
            const batch = await (models as any).ProductBatch.findOne({
              _id:    new Types.ObjectId(item.batchId.toString()),
              userId: ownerId,
            })
            if (batch) {
              batch.quantity  = (batch.quantity || 0) + item.quantity
              batch.status    = 'active'  // re-activate if it was depleted
              batch.updatedAt = new Date()
              await batch.save()
            }
          } catch (batchErr) {
            console.error('[sales/[id] DELETE] ProductBatch restore failed:', batchErr)
          }
        }

        // Write compensating StockLedger entry (immutable ledger — never delete)
        try {
          await (models as any).StockLedger.create({
            userId:        ownerId,
            branchId:      effectiveBranch ? new Types.ObjectId(effectiveBranch) : null,
            productId:     productObjId,
            saleId:        sale._id,
            staffId:       staffId ? new Types.ObjectId(staffId) : null,
            type:          'ADJUSTMENT',
            quantity:      item.quantity,   // positive = stock returned
            previousStock,
            newStock,
            reference:     'VOID',
            notes:         `Voided — ${sale.orderNumber || sale._id.toString()}`,
            timestamp:     new Date(),
          })
        } catch (ledgerErr) {
          console.error('[sales/[id] DELETE] StockLedger compensating entry failed:', ledgerErr)
        }
      } catch (itemErr) {
        console.error('[sales/[id] DELETE] Stock reversal failed for item:', item.productId, itemErr)
      }
    }

    // ── B. Customer financial reversal ────────────────────────────────────────
    if (sale.customerId) {
      try {
        const customer = await models.Customer.findById(sale.customerId)
        if (customer) {
          // Reverse outstanding debt from this sale (only if it was never paid off)
          const debtToReverse = sale.debt || 0
          if (debtToReverse > 0) {
            // Never let the reversal push creditBalance below 0 — the customer may
            // have already paid part of this debt through a separate payment entry.
            customer.creditBalance = Math.max(0, (customer.creditBalance || 0) - debtToReverse)
            customer.ledger.push({
              date:    new Date(),
              type:    'adjustment',
              amount:  -debtToReverse,
              balance: customer.creditBalance,
              saleId:  sale._id,
              note:    `Order ${sale.orderNumber || sale._id.toString()} voided — debt reversed`,
            })
          }

          // Restore deposit balance for any deposit-payment lines
          const depositPayments = (sale.payments || []).filter(
            (p: any) => p.method === 'deposit' && p.depositId && p.amount > 0
          )
          for (const dp of depositPayments) {
            try {
              const depositDoc = await models.Deposit.findById(
                new Types.ObjectId(dp.depositId.toString())
              )
              if (depositDoc) {
                depositDoc.balance = (depositDoc.balance || 0) + dp.amount
                // Re-activate deposit if it was fully used
                if (depositDoc.status === 'used') depositDoc.status = 'partial'
                await depositDoc.save()

                // Mirror on customer deposit balance
                customer.depositBalance = (customer.depositBalance || 0) + dp.amount
                customer.ledger.push({
                  date:      new Date(),
                  type:      'deposit_return',
                  amount:    dp.amount,
                  balance:   customer.depositBalance,
                  saleId:    sale._id,
                  depositId: depositDoc._id,
                  note:      `Order ${sale.orderNumber || sale._id.toString()} voided — deposit restored`,
                })
              }
            } catch (depositErr) {
              console.error('[sales/[id] DELETE] Deposit restore failed:', dp.depositId, depositErr)
            }
          }

          await customer.save()
        }
      } catch (customerErr) {
        console.error('[sales/[id] DELETE] Customer reversal failed:', customerErr)
      }
    }

    // ── C. Mark the sale as voided ────────────────────────────────────────────
    sale.status     = 'voided'
    sale.voidedAt   = new Date()
    sale.voidedBy   = staffId ? new Types.ObjectId(staffId) : null
    sale.voidReason = voidReason
    await sale.save()

    return NextResponse.json({
      success:     true,
      orderNumber: sale.orderNumber,
      voidedAt:    sale.voidedAt,
    })

  } catch (error) {
    console.error('[sales/[id] DELETE] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to void order.' },
      { status: 500 }
    )
  }
}
