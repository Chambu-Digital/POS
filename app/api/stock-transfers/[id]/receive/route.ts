import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { canApproveTransfer, validateBranchAccess } from '@/lib/staff-branch-permissions'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── PUT: Receive stock transfer ────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Resolve id first — used in both staff auth check and main query
    const { id } = await params

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Validate current branch context
    const branchContext = await getBranchContext(request)
    if (!branchContext) {
      return NextResponse.json({ error: 'Branch context is required' }, { status: 400 })
    }

    // If staff, verify manager status and branch access using JWT token
    if (payload.type === 'staff') {
      if (!canApproveTransfer({ isBranchManager: payload.isBranchManager })) {
        return NextResponse.json({
          error: 'Only branch managers can approve transfers. Contact your branch manager.',
        }, { status: 403 })
      }

      try {
        validateBranchAccess(
          {
            isBranchManager: payload.isBranchManager,
            managerOfBranches: payload.managerOfBranches,
            branchId: payload.branchId,
          },
          branchContext,
          'receive transfer at this branch'
        )
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    const body = await request.json()
    const { items: receivedItems } = body // Array with quantityReceived per item

    // Find transfer
    const transfer = await models.StockTransfer.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
      toBranchId: branchContext,
      status: 'pending_receipt',
    })

    if (!transfer) {
      return NextResponse.json({
        error: 'Transfer not found or already processed',
      }, { status: 404 })
    }

    // Start transaction
    const session = await models.StockTransfer.db.startSession()
    session.startTransaction()

    try {
      // Process each item
      for (const receivedItem of receivedItems) {
        const transferItem = transfer.items.find(
          (item: any) =>
            (item.productId && item.productId.toString() === receivedItem.itemId) ||
            (item.drugId && item.drugId.toString() === receivedItem.itemId)
        )

        if (!transferItem) {
          throw new Error(`Item ${receivedItem.itemId} not found in transfer`)
        }

        const quantityReceived = receivedItem.quantityReceived || transferItem.quantitySent

        if (transferItem.productId) {
          // Handle retail products - use ProductInventory
          let inventory = await models.ProductInventory.findOne({
            userId: ownerId,
            branchId: branchContext,
            productId: transferItem.productId,
          }).session(session)

          if (!inventory) {
            inventory = await models.ProductInventory.create([{
              userId: ownerId,
              branchId: branchContext,
              productId: transferItem.productId,
              stock: quantityReceived,
              reserved: 0,
            }], { session })
            inventory = inventory[0]

            await models.StockLedger.create([{
              userId: ownerId,
              branchId: branchContext ? new Types.ObjectId(branchContext) : null,
              productId: transferItem.productId,
              type: 'TRANSFER_IN',
              quantity: quantityReceived,
              previousStock: 0,
              newStock: quantityReceived,
              notes: `Transfer received from branch - ${transfer.transferNumber} (initial stock)`,
              staffId: payload.type === 'staff' ? payload.userId : undefined,
            }], { session })
          } else {
            const previousStock = inventory.stock
            inventory.stock += quantityReceived
            inventory.lastUpdated = new Date()
            await inventory.save({ session })

            await models.StockLedger.create([{
              userId: ownerId,
              branchId: branchContext ? new Types.ObjectId(branchContext) : null,
              productId: transferItem.productId,
              type: 'TRANSFER_IN',
              quantity: quantityReceived,
              previousStock,
              newStock: inventory.stock,
              notes: `Transfer received from branch - ${transfer.transferNumber}`,
              staffId: payload.type === 'staff' ? payload.userId : undefined,
            }], { session })
          }

          // ── Lot tracking: create new batches at destination ─────────────
          // Each entry in lotBreakdown becomes a new ProductBatch at the
          // receiving branch. Source batches are already decremented on
          // TRANSFER_OUT — we never move/share batch records across branches.
          if (transferItem.lotBreakdown && Array.isArray(transferItem.lotBreakdown) && transferItem.lotBreakdown.length > 0) {
            for (const lotEntry of transferItem.lotBreakdown) {
              if (!lotEntry.quantity) continue
              const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
              const rand    = Math.random().toString(36).substring(2, 6).toUpperCase()
              const lotId   = `LOT-${dateStr}-${rand}`
              try {
                await (models as any).ProductBatch.create([{
                  userId:           ownerId,
                  branchId:         new Types.ObjectId(branchContext),
                  productId:        transferItem.productId,
                  lotId,
                  lotLabel:         lotEntry.lotLabel || lotId,
                  supplierLot:      transfer.transferNumber,
                  quantity:         lotEntry.quantity,
                  initialQuantity:  lotEntry.quantity,
                  reservedQuantity: 0,
                  receivedDate:     new Date(),
                  status:           'active',
                  notes:            `Transferred from branch — ${transfer.transferNumber}`,
                }], { session })
              } catch (batchErr) {
                console.error('[stock-transfers/receive] ProductBatch creation failed:', batchErr)
              }
            }
          }

        } else if (transferItem.drugId) {
          // Handle pharmacy drugs
          let inventory = await models.Inventory.findOne({
            userId: ownerId,
            branchId: branchContext,
            drugId: transferItem.drugId,
          }).session(session)

          if (!inventory) {
            inventory = await models.Inventory.create([{
              userId: ownerId,
              branchId: branchContext,
              drugId: transferItem.drugId,
              quantityAvailable: quantityReceived,
              quantityReserved: 0,
            }], { session })
            inventory = inventory[0]
          } else {
            const previousBalance = inventory.quantityAvailable
            inventory.quantityAvailable += quantityReceived
            inventory.lastStockUpdate = new Date()
            await inventory.save({ session })

            await models.InventoryTransaction.create([{
              userId: ownerId,
              branchId: branchContext,
              drugId: transferItem.drugId,
              type: 'TRANSFER',
              quantity: quantityReceived,
              previousBalance,
              newBalance: inventory.quantityAvailable,
              referenceId: transfer._id.toString(),
              referenceType: 'transfer',
              userIdPerformed: payload.type === 'staff' ? payload.userId : ownerId,
              reason: `Transfer received - ${transfer.transferNumber}`,
            }], { session })
          }
        }

        // ── Clear the reservation on the SOURCE branch ───────────────────
        // Stock was deducted from the source when the transfer was created
        // (reserveInventory: stock -= qty, reserved += qty). Now that the
        // transfer is received, the stock is confirmed gone — clear the
        // 'reserved' marker. For partial receipts, return the unreceived
        // portion back to available stock.
        const unreceived = Math.max(0, (transferItem.quantitySent || 0) - quantityReceived)

        if (transferItem.productId) {
          const sourceInv = await models.ProductInventory.findOne({
            userId: ownerId,
            branchId: transfer.fromBranchId,
            productId: transferItem.productId,
          }).session(session)

          if (sourceInv) {
            sourceInv.reserved = Math.max(
              0,
              (sourceInv.reserved || 0) - (transferItem.quantitySent || 0),
            )
            if (unreceived > 0) sourceInv.stock += unreceived
            sourceInv.lastUpdated = new Date()
            await sourceInv.save({ session })
          }
        } else if (transferItem.drugId) {
          const sourceInv = await models.Inventory.findOne({
            userId: ownerId,
            branchId: transfer.fromBranchId,
            drugId: transferItem.drugId,
          }).session(session)

          if (sourceInv) {
            sourceInv.quantityReserved = Math.max(
              0,
              (sourceInv.quantityReserved || 0) - (transferItem.quantitySent || 0),
            )
            if (unreceived > 0) sourceInv.quantityAvailable += unreceived
            sourceInv.lastStockUpdate = new Date()
            await sourceInv.save({ session })
          }
        }

        // Update received quantity in transfer item
        transferItem.quantityReceived = quantityReceived
      }

      // Update transfer status
      transfer.status = 'received'
      transfer.receivedBy = payload.type === 'staff' ? new Types.ObjectId(payload.userId) : null
      transfer.receivedAt = new Date()
      await transfer.save({ session })

      // Notify sender
      if (transfer.createdBy) {
        await models.Notification.create([{
          userId: ownerId,
          recipientId: transfer.createdBy,
          recipientType: transfer.createdByModel === 'Staff' ? 'staff' : 'user',
          type: 'info',
          title: 'Transfer Received',
          message: `Transfer ${transfer.transferNumber} has been received`,
          referenceId: transfer._id,
          referenceType: 'stock_transfer',
        }], { session })
      }

      await session.commitTransaction()

      return NextResponse.json({
        transfer,
        message: 'Transfer received successfully',
      })

    } catch (error: any) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }

  } catch (error: any) {
    console.error('[stock-transfers/receive] PUT error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to receive transfer',
    }, { status: 500 })
  }
}
