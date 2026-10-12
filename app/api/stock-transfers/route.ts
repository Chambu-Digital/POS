import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { activeOnlyQuery } from '@/lib/branch-validation'
import { reserveInventory, releaseReservation } from '@/lib/inventory-reservation'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── GET: List stock transfers ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status')
    const direction = searchParams.get('direction') // 'sent' or 'received'
    const branchContext = await getBranchContext(request)

    const query: any = { userId: ownerId }
    if (status) query.status = status

    // Filter by direction if specified
    if (direction === 'sent' && branchContext) {
      query.fromBranchId = branchContext
    } else if (direction === 'received' && branchContext) {
      query.toBranchId = branchContext
    } else if (branchContext && payload.type === 'staff') {
      // Staff can only see transfers involving their branch
      query.$or = [
        { fromBranchId: branchContext },
        { toBranchId: branchContext },
      ]
    }

    const transfers = await models.StockTransfer.find(query)
      .populate('fromBranchId', 'name code')
      .populate('toBranchId', 'name code')
      .populate('createdBy', 'name email')
      .populate('receivedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ transfers })
  } catch (error) {
    console.error('[stock-transfers] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 })
  }
}

// ── POST: Create new stock transfer ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Anyone with access can create a transfer (approval happens at receiving end)
    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await request.json()
    const { toBranchId, items, notes } = body

    // Validate required fields
    if (!toBranchId || !items || items.length === 0) {
      return NextResponse.json({ error: 'toBranchId and items are required' }, { status: 400 })
    }

    // Get source branch (current context)
    const fromBranchId = await getBranchContext(request)
    if (!fromBranchId) {
      return NextResponse.json({ error: 'Source branch context is required' }, { status: 400 })
    }

    // Validate branches exist AND are active
    const [fromBranch, toBranch] = await Promise.all([
      models.Branch.findOne(activeOnlyQuery({ _id: fromBranchId, userId: ownerId })),
      models.Branch.findOne(activeOnlyQuery({ _id: toBranchId, userId: ownerId })),
    ])

    if (!fromBranch) {
      return NextResponse.json({ error: 'Source branch not found or is not active' }, { status: 400 })
    }
    if (!toBranch) {
      return NextResponse.json({ error: 'Destination branch not found or is not active' }, { status: 400 })
    }

    if (fromBranchId === toBranchId) {
      return NextResponse.json({ error: 'Cannot transfer to same branch' }, { status: 400 })
    }

    // Validate and deduct stock for each item
    const session = await models.StockTransfer.db.startSession()
    session.startTransaction()

    try {
      // Validate and reserve stock, then create TRANSFER_OUT ledger entries
      for (const item of items) {
        // Reserve stock (pessimistic lock) - throws if insufficient
        const itemType = item.productId ? 'product' : 'drug'
        const itemId = item.productId || item.drugId

        try {
          await reserveInventory(
            models,
            ownerId,
            fromBranchId,
            itemId,
            itemType,
            item.quantitySent,
            new Types.ObjectId(), // Will be filled with actual transfer ID later
            session
          )
        } catch (error: any) {
          throw new Error(`Failed to reserve ${item.itemName}: ${error.message}`)
        }
      }

      // Generate transfer number
      const count = await models.StockTransfer.countDocuments({ userId: ownerId }).session(session)
      const transferNumber = `ST-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

      // Create transfer record
      const transfer = await models.StockTransfer.create([{
        userId: ownerId,
        transferNumber,
        fromBranchId,
        toBranchId,
        items,
        status: 'pending_receipt',
        createdBy: payload.type === 'staff' ? payload.userId : ownerId,
        createdByModel: payload.type === 'staff' ? 'Staff' : 'User',
        notes: notes || '',
      }], { session })

      // Create TRANSFER_OUT StockLedger entries for each product
      for (const item of items) {
        if (item.productId) {
          // Get current inventory to record stock levels
          const inventory = await models.ProductInventory.findOne({
            userId: ownerId,
            branchId: fromBranchId,
            productId: new Types.ObjectId(item.productId),
          }).session(session)

          if (inventory) {
            await models.StockLedger.create([{
              userId: ownerId,
              branchId: fromBranchId,
              productId: new Types.ObjectId(item.productId),
              type: 'TRANSFER_OUT',
              quantity: -item.quantitySent,
              previousStock: inventory.stock + inventory.reserved, // Before reservation
              newStock: inventory.stock, // After deduction (reserved subtracted)
              notes: `Transfer to ${toBranch.name} - ${transferNumber}`,
              reference: transferNumber,
              staffId: payload.type === 'staff' ? new Types.ObjectId(payload.userId) : undefined,
              timestamp: new Date(),
            }], { session })
          }
        }
      }

      // Create notification for receiving branch staff/manager
      const receivingStaff = await models.Staff.find({
        userId: ownerId,
        branchId: toBranchId,
        active: true,
        'permissions.core.stock-transfers.receive': true,
      }).session(session)

      if (receivingStaff.length > 0) {
        const notifications = receivingStaff.map(staff => ({
          userId: ownerId,
          recipientId: staff._id,
          recipientType: 'staff',
          type: 'transfer_received',
          title: 'New Stock Transfer',
          message: `You have a pending stock transfer (${transferNumber}) from ${fromBranch.name}`,
          referenceId: transfer[0]._id,
          referenceType: 'stock_transfer',
        }))
        await models.Notification.insertMany(notifications, { session })
      }

      await session.commitTransaction()

      return NextResponse.json({
        transfer: transfer[0],
        message: 'Transfer created successfully and stock reserved',
      }, { status: 201 })

    } catch (error: any) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }

  } catch (error: any) {
    console.error('[stock-transfers] POST error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create transfer' 
    }, { status: 500 })
  }
}
