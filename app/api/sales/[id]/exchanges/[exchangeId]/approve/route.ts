// ─── PATCH /api/sales/[id]/exchanges/[exchangeId]/approve ─────────────────────
// Approve or reject a pending exchange request.
// On approval: loops over returnedItems[] (EXCHANGE_IN) and newItems[] (EXCHANGE_OUT),
// updates stock + ledger for every line, then handles customer credit/debit.
// Falls back to legacy singular fields for old exchange records.

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; exchangeId: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only owners can approve
    if (payload.type !== 'user') {
      return NextResponse.json({ error: 'Only owners can approve exchanges' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.userId
    const branchContext = await getBranchContext(request)

    const { id, exchangeId } = await params
    const data = await request.json()
    const { status } = data

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const saleId = new Types.ObjectId(id)
    const sale = await models.Sale.findOne({ _id: saleId, userId: ownerId })
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const exchangeIndex = sale.exchanges.findIndex((e: any) => e._id.toString() === exchangeId)
    if (exchangeIndex === -1) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 })

    const ex = sale.exchanges[exchangeIndex]
    if (ex.status !== 'pending') {
      return NextResponse.json({ error: 'Exchange already processed' }, { status: 400 })
    }

    // Stamp approval metadata — kept in memory for reference during the
    // approval block below; actual persistence happens via findByIdAndUpdate
    // at the end so we never call sale.save() and never trigger full-document
    // validation on legacy subdocuments.
    const approvalMeta = {
      status,
      approvedBy: new Types.ObjectId(ownerId),
      approvedAt: new Date(),
    }

    if (status === 'approved') {
      // ── Helpers ────────────────────────────────────────────────────────────

      async function applyStockIn(
        productObjId: Types.ObjectId,
        quantity: number,
        productName: string
      ) {
        const product = await models.Product.findOne({ _id: productObjId, userId: ownerId })
        if (!product) {
          console.warn(`[exchange/approve] EXCHANGE_IN: product not found ${productObjId}`)
          return
        }
        const prevStock = product.stock || 0
        const newStock = prevStock + quantity

        await models.Product.findByIdAndUpdate(productObjId, {
          stock: newStock,
          updatedAt: new Date(),
        })

        if (branchContext) {
          await models.ProductInventory.findOneAndUpdate(
            { userId: ownerId, branchId: branchContext, productId: productObjId },
            { $inc: { stock: quantity }, lastUpdated: new Date() }
          )
        }

        await (models as any).StockLedger.create({
          userId: ownerId,
          branchId: branchContext ? new Types.ObjectId(branchContext) : null,
          productId: productObjId,
          saleId,
          staffId: ex.processedBy || null,
          type: 'EXCHANGE_IN',
          quantity,
          previousStock: prevStock,
          newStock,
          orderNumber: sale.orderNumber,
          reason: ex.reason,
          notes: `Approved exchange: ${ex.notes || ''}`.trim(),
          timestamp: new Date(),
        })
      }

      async function applyStockOut(
        productObjId: Types.ObjectId,
        quantity: number,
        productName: string
      ) {
        const product = await models.Product.findOne({ _id: productObjId, userId: ownerId })
        if (!product) {
          console.warn(`[exchange/approve] EXCHANGE_OUT: product not found ${productObjId}`)
          return
        }
        const prevStock = product.stock || 0
        const newStock = Math.max(0, prevStock - quantity)

        await models.Product.findByIdAndUpdate(productObjId, {
          stock: newStock,
          updatedAt: new Date(),
        })

        if (branchContext) {
          await models.ProductInventory.findOneAndUpdate(
            { userId: ownerId, branchId: branchContext, productId: productObjId },
            { $inc: { stock: -quantity }, lastUpdated: new Date() }
          )
        }

        await (models as any).StockLedger.create({
          userId: ownerId,
          branchId: branchContext ? new Types.ObjectId(branchContext) : null,
          productId: productObjId,
          saleId,
          staffId: ex.processedBy || null,
          type: 'EXCHANGE_OUT',
          quantity: -quantity,
          previousStock: prevStock,
          newStock,
          orderNumber: sale.orderNumber,
          reason: ex.reason,
          notes: `Approved exchange: ${ex.notes || ''}`.trim(),
          timestamp: new Date(),
        })
      }

      // ── Process returned items (stock IN) ─────────────────────────────────
      // New format: returnedItems[] array
      // Legacy fallback: singular returnedProductId / quantityReturned
      const returnedItems: Array<{ productId: Types.ObjectId; productName: string; quantity: number }> =
        ex.returnedItems && ex.returnedItems.length > 0
          ? ex.returnedItems.map((ri: any) => ({
              productId: ri.productId,
              productName: ri.productName,
              quantity: ri.quantity,
            }))
          : ex.returnedProductId
          ? [{ productId: ex.returnedProductId, productName: ex.returnedProductName, quantity: ex.quantityReturned }]
          : []

      for (const ri of returnedItems) {
        await applyStockIn(ri.productId, ri.quantity, ri.productName)
      }

      // ── Process new items (stock OUT) ─────────────────────────────────────
      // New format: newItems[] array
      // Legacy fallback: singular newProductId / quantityReceived
      const newItems: Array<{ productId: Types.ObjectId; productName: string; quantity: number }> =
        ex.newItems && ex.newItems.length > 0
          ? ex.newItems.map((ni: any) => ({
              productId: ni.productId,
              productName: ni.productName,
              quantity: ni.quantity,
            }))
          : ex.newProductId
          ? [{ productId: ex.newProductId, productName: ex.newProductName, quantity: ex.quantityReceived }]
          : []

      for (const ni of newItems) {
        await applyStockOut(ni.productId, ni.quantity, ni.productName)
      }

      // ── Customer ledger for net price difference ──────────────────────────
      const priceDifference = ex.priceDifference

      // Build human-readable product name summaries for the ledger note
      const returnedSummary = returnedItems.map(r => r.productName).join(', ')
      const newSummary = newItems.map(n => n.productName).join(', ')

      if (sale.customerId && priceDifference !== 0) {
        const customer = await models.Customer.findById(sale.customerId)
        if (customer) {
          if (priceDifference > 0) {
            // Customer owes extra — add to debt when paymentMethod is credit
            if (ex.paymentMethod === 'credit') {
              customer.creditBalance = (customer.creditBalance || 0) + priceDifference
              customer.ledger.push({
                date: new Date(),
                type: 'purchase',
                amount: priceDifference,
                balance: customer.creditBalance,
                saleId,
                note: `Exchange surcharge: [${returnedSummary}] → [${newSummary}]`,
              })
            }
            // For cash/other methods the cashier collected the amount at the counter;
            // no ledger entry needed.
          } else {
            // Customer gets credit back
            const creditAmount = Math.abs(priceDifference)
            customer.creditBalance = (customer.creditBalance || 0) - creditAmount
            customer.ledger.push({
              date: new Date(),
              type: 'payment',
              amount: -creditAmount,
              balance: customer.creditBalance,
              saleId,
              note: `Exchange credit: [${returnedSummary}] → [${newSummary}]`,
            })
          }
          await customer.save()
        }
      }

      // ── Update sale totals and status ─────────────────────────────────────
      const approvedExchanges = sale.exchanges.filter((e: any) => 
        e._id.toString() === exchangeId ? true : e.status === 'approved'
      )
      const newTotalExchanged = approvedExchanges.reduce(
        (sum: number, e: any) => sum + (e.priceDifference || 0), 0
      )

      // Use findByIdAndUpdate to write only the fields we're changing.
      // This avoids triggering full-document validation (which would reject
      // existing exchange subdocuments that were saved before 'reason' became
      // optional) while still being precise about what we intend to update.
      await models.Sale.findByIdAndUpdate(
        saleId,
        {
          $set: {
            [`exchanges.${exchangeIndex}.status`]: status,
            [`exchanges.${exchangeIndex}.approvedBy`]: new Types.ObjectId(ownerId),
            [`exchanges.${exchangeIndex}.approvedAt`]: new Date(),
            totalExchanged: newTotalExchanged,
            status: 'exchanged',
          },
        },
        { runValidators: false }
      )
    } else {
      // Rejection: only update the exchange status fields
      await models.Sale.findByIdAndUpdate(
        saleId,
        {
          $set: {
            [`exchanges.${exchangeIndex}.status`]: status,
            [`exchanges.${exchangeIndex}.approvedBy`]: new Types.ObjectId(ownerId),
            [`exchanges.${exchangeIndex}.approvedAt`]: new Date(),
          },
        },
        { runValidators: false }
      )
    }

    // Re-fetch the updated exchange entry to return in the response
    const updatedSale = await models.Sale.findById(saleId).lean() as any
    const updatedExchange = updatedSale?.exchanges?.[exchangeIndex]

    return NextResponse.json({
      success: true,
      message: `Exchange ${status}`,
      exchangeEntry: updatedExchange,
    })
  } catch (error) {
    console.error('[exchanges/approve] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to process exchange approval' }, { status: 500 })
  }
}
