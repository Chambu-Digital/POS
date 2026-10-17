// ─── PATCH /api/sales/[id]/exchanges/[exchangeId]/approve ─────────────────────
// Approve or reject a pending exchange request
// On approval: processes stock changes, customer ledger updates, and sale status

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

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const saleId = new Types.ObjectId(id)
    
    // Get sale
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Find the exchange entry
    const exchangeIndex = sale.exchanges.findIndex((e: any) => e._id.toString() === exchangeId)
    if (exchangeIndex === -1) {
      return NextResponse.json({ error: 'Exchange not found' }, { status: 404 })
    }

    const exchangeEntry = sale.exchanges[exchangeIndex]

    // Check if already processed
    if (exchangeEntry.status !== 'pending') {
      return NextResponse.json({ error: 'Exchange already processed' }, { status: 400 })
    }

    // Update exchange status
    sale.exchanges[exchangeIndex].status = status
    sale.exchanges[exchangeIndex].approvedBy = new Types.ObjectId(ownerId)
    sale.exchanges[exchangeIndex].approvedAt = new Date()

    // If approved, process stock changes and customer ledger
    if (status === 'approved') {
      const returnedProductObjId = exchangeEntry.returnedProductId
      const newProductObjId = exchangeEntry.newProductId

      // Update stock for returned product (add back to inventory)
      const returnedProduct = await models.Product.findOne({
        _id: returnedProductObjId,
        userId: ownerId,
      })

      if (returnedProduct) {
        const returnedPrevStock = returnedProduct.stock || 0
        const returnedNewStock = returnedPrevStock + exchangeEntry.quantityReturned

        await models.Product.findByIdAndUpdate(
          returnedProductObjId,
          {
            stock: returnedNewStock,
            updatedAt: new Date(),
          }
        )

        // Update ProductInventory if multi-branch
        if (branchContext) {
          await models.ProductInventory.findOneAndUpdate(
            {
              userId: ownerId,
              branchId: branchContext,
              productId: returnedProductObjId,
            },
            {
              $inc: { stock: exchangeEntry.quantityReturned },
              lastUpdated: new Date(),
            }
          )
        }

        // Create stock ledger entry for returned product
        await (models as any).StockLedger.create({
          userId: ownerId,
          branchId: branchContext ? new Types.ObjectId(branchContext) : null,
          productId: returnedProductObjId,
          saleId: saleId,
          staffId: exchangeEntry.processedBy || null,
          type: 'EXCHANGE_IN',
          quantity: exchangeEntry.quantityReturned,
          previousStock: returnedPrevStock,
          newStock: returnedNewStock,
          orderNumber: sale.orderNumber,
          reason: exchangeEntry.reason,
          notes: `Approved exchange: ${exchangeEntry.notes || ''}`,
          timestamp: new Date(),
        })
      }

      // Update stock for new product (remove from inventory)
      const newProduct = await models.Product.findOne({
        _id: newProductObjId,
        userId: ownerId,
      })

      if (newProduct) {
        const newPrevStock = newProduct.stock || 0
        const newNewStock = Math.max(0, newPrevStock - exchangeEntry.quantityReceived)

        await models.Product.findByIdAndUpdate(
          newProductObjId,
          {
            stock: newNewStock,
            updatedAt: new Date(),
          }
        )

        // Update ProductInventory if multi-branch
        if (branchContext) {
          await models.ProductInventory.findOneAndUpdate(
            {
              userId: ownerId,
              branchId: branchContext,
              productId: newProductObjId,
            },
            {
              $inc: { stock: -exchangeEntry.quantityReceived },
              lastUpdated: new Date(),
            }
          )
        }

        // Create stock ledger entry for new product
        await (models as any).StockLedger.create({
          userId: ownerId,
          branchId: branchContext ? new Types.ObjectId(branchContext) : null,
          productId: newProductObjId,
          saleId: saleId,
          staffId: exchangeEntry.processedBy || null,
          type: 'EXCHANGE_OUT',
          quantity: -exchangeEntry.quantityReceived,
          previousStock: newPrevStock,
          newStock: newNewStock,
          orderNumber: sale.orderNumber,
          reason: exchangeEntry.reason,
          notes: `Approved exchange: ${exchangeEntry.notes || ''}`,
          timestamp: new Date(),
        })
      }

      // Handle customer ledger for price difference
      const priceDifference = exchangeEntry.priceDifference

      if (sale.customerId && priceDifference !== 0) {
        const customer = await models.Customer.findById(sale.customerId)

        if (customer) {
          if (priceDifference > 0) {
            // Customer pays extra (or if using credit, add to their debt)
            if (exchangeEntry.paymentMethod === 'credit') {
              customer.creditBalance = (customer.creditBalance || 0) + priceDifference
              customer.ledger.push({
                date: new Date(),
                type: 'purchase',
                amount: priceDifference,
                balance: customer.creditBalance,
                saleId: saleId,
                note: `Exchange surcharge: ${exchangeEntry.returnedProductName} → ${exchangeEntry.newProductName}`,
              })
            }
          } else {
            // Customer receives credit (negative difference)
            const creditAmount = Math.abs(priceDifference)
            customer.creditBalance = (customer.creditBalance || 0) - creditAmount
            customer.ledger.push({
              date: new Date(),
              type: 'payment',
              amount: -creditAmount,
              balance: customer.creditBalance,
              saleId: saleId,
              note: `Exchange credit: ${exchangeEntry.returnedProductName} → ${exchangeEntry.newProductName}`,
            })
          }

          await customer.save()
        }
      }

      // Update sale totals and status
      const approvedExchanges = sale.exchanges.filter((e: any) => e.status === 'approved')
      const totalExchanged = approvedExchanges.reduce((sum: number, e: any) => sum + (e.priceDifference || 0), 0)
      
      sale.totalExchanged = totalExchanged
      sale.status = 'exchanged'
    }

    await sale.save()

    return NextResponse.json({
      success: true,
      message: `Exchange ${status}`,
      exchangeEntry: sale.exchanges[exchangeIndex],
    })
  } catch (error) {
    console.error('[exchanges/approve] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to process exchange approval' }, { status: 500 })
  }
}
