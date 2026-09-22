import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
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

    // Check permission
    if (payload.type === 'staff' && !payload.permissions?.['stock-transfers.create']) {
      return NextResponse.json({ error: 'No permission to create transfers' }, { status: 403 })
    }

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

    // Validate branches exist
    const [fromBranch, toBranch] = await Promise.all([
      models.Branch.findOne({ _id: fromBranchId, userId: ownerId }),
      models.Branch.findOne({ _id: toBranchId, userId: ownerId }),
    ])

    if (!fromBranch || !toBranch) {
      return NextResponse.json({ error: 'Invalid branches' }, { status: 400 })
    }

    if (fromBranchId === toBranchId) {
      return NextResponse.json({ error: 'Cannot transfer to same branch' }, { status: 400 })
    }

    // Generate transfer number
    const count = await models.StockTransfer.countDocuments({ userId: ownerId })
    const transferNumber = `ST-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

    // Validate and deduct stock for each item
    const session = await models.StockTransfer.db.startSession()
    session.startTransaction()

    try {
      for (const item of items) {
        // Check if it's a product (retail)
        if (item.productId) {
          const inventory = await models.ProductInventory.findOne({
            userId: ownerId,
            branchId: fromBranchId,
            productId: item.productId,
          }).session(session)

          if (!inventory) {
            throw new Error(`Product ${item.itemName} not found in branch inventory`)
          }

          if (inventory.stock < item.quantitySent) {
            throw new Error(`Insufficient stock for ${item.itemName}. Available: ${inventory.stock}, Requested: ${item.quantitySent}`)
          }

          // Deduct stock from ProductInventory
          const previousStock = inventory.stock
          inventory.stock -= item.quantitySent
          inventory.lastUpdated = new Date()
          await inventory.save({ session })

          // Create ledger entry
          await models.StockLedger.create([{
            userId: ownerId,
            productId: item.productId,
            type: 'TRANSFER_OUT',
            quantity: -item.quantitySent,
            previousStock,
            newStock: inventory.stock,
            notes: `Transfer to ${toBranch.name} - ${transferNumber}`,
            staffId: payload.type === 'staff' ? payload.userId : undefined,
          }], { session })

        } else if (item.drugId) {
          // Handle pharmacy drugs
          const inventory = await models.Inventory.findOne({
            userId: ownerId,
            branchId: fromBranchId,
            drugId: item.drugId,
          }).session(session)

          if (!inventory) {
            throw new Error(`Drug ${item.itemName} not found in inventory`)
          }

          if (inventory.quantityAvailable < item.quantitySent) {
            throw new Error(`Insufficient stock for ${item.itemName}. Available: ${inventory.quantityAvailable}, Requested: ${item.quantitySent}`)
          }

          // Deduct inventory
          inventory.quantityAvailable -= item.quantitySent
          inventory.lastStockUpdate = new Date()
          await inventory.save({ session })

          // Create transaction entry
          await models.InventoryTransaction.create([{
            userId: ownerId,
            branchId: fromBranchId,
            drugId: item.drugId,
            type: 'TRANSFER',
            quantity: -item.quantitySent,
            previousBalance: inventory.quantityAvailable + item.quantitySent,
            newBalance: inventory.quantityAvailable,
            referenceType: 'transfer',
            userIdPerformed: payload.type === 'staff' ? payload.userId : ownerId,
            reason: `Transfer to ${toBranch.name} - ${transferNumber}`,
          }], { session })
        } else {
          throw new Error(`Invalid item: must have either productId or drugId`)
        }
      }

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

      // Create notification for receiving branch staff/manager
      const receivingStaff = await models.Staff.find({
        userId: ownerId,
        branchId: toBranchId,
        active: true,
        'permissions.stock-transfers.receive': true,
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
        message: 'Transfer created successfully',
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
