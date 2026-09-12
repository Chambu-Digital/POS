import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { Types } from 'mongoose'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const params = await context.params
    const rawId = params.id
    const id = rawId?.trim() // Remove any whitespace

    console.log('PO Detail GET - Raw ID:', JSON.stringify(rawId))
    console.log('PO Detail GET - Trimmed ID:', JSON.stringify(id))
    console.log('PO Detail GET - ID length:', id?.length)
    console.log('PO Detail GET - IsValid:', Types.ObjectId.isValid(id))

    // Validate ObjectId format
    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID', receivedId: id, rawId, idLength: id?.length },
        { status: 400 }
      )
    }

    const purchaseOrder = await models.PurchaseOrder
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(ownerId) })
      .lean()

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Stringify ObjectIds for JSON serialization
    const serializedPO = {
      ...purchaseOrder,
      _id: purchaseOrder._id.toString(),
      userId: purchaseOrder.userId.toString(),
      supplierId: purchaseOrder.supplierId?.toString() || null,
      createdBy: purchaseOrder.createdBy?.toString() || null
    }

    return NextResponse.json({ purchaseOrder: serializedPO })
  } catch (error: any) {
    console.error('Get PO error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const editorId = payload.userId
    const editorModel = payload.type === 'staff' ? 'Staff' : 'User'
    const params = await context.params
    const { id } = params
    const body = await request.json()

    // Fetch existing PO
    const existingPO = await models.PurchaseOrder.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(ownerId)
    })

    if (!existingPO) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Validation: Only draft POs can have items edited
    if (body.items && existingPO.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft purchase orders can have items modified' },
        { status: 403 }
      )
    }

    // Track changes for history
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = []

    const updates: any = {}

    // Handle simple field updates (status, notes, supplierName)
    const allowedSimpleUpdates = ['status', 'notes', 'supplierName']
    for (const key of allowedSimpleUpdates) {
      if (key in body && body[key] !== existingPO[key]) {
        changes.push({
          field: key,
          oldValue: existingPO[key],
          newValue: body[key]
        })
        updates[key] = body[key]
      }
    }

    // Handle items update (only for draft)
    if (body.items && existingPO.status === 'draft') {
      const oldItemsStr = JSON.stringify(existingPO.items)
      const newItemsStr = JSON.stringify(body.items)
      
      if (oldItemsStr !== newItemsStr) {
        changes.push({
          field: 'items',
          oldValue: existingPO.items.length + ' items',
          newValue: body.items.length + ' items'
        })
        updates.items = body.items

        // Recalculate totals
        const subtotal = body.items.reduce((sum: number, item: any) => 
          sum + (item.quantity * item.unitPrice), 0
        )
        updates.subtotal = subtotal
        updates.total = subtotal

        changes.push({
          field: 'total',
          oldValue: existingPO.total,
          newValue: subtotal
        })
      }
    }

    // Handle supplier change
    if (body.supplierId && body.supplierId !== existingPO.supplierId?.toString()) {
      changes.push({
        field: 'supplierId',
        oldValue: existingPO.supplierId?.toString() || null,
        newValue: body.supplierId
      })
      updates.supplierId = new Types.ObjectId(body.supplierId)
    }

    // Only update if there are changes
    if (changes.length === 0) {
      return NextResponse.json({ purchaseOrder: existingPO })
    }

    // Add edit history entry
    const historyEntry = {
      editedBy: new Types.ObjectId(editorId),
      editedByModel: editorModel,
      editedAt: new Date(),
      changes
    }

    updates.updatedAt = new Date()

    const purchaseOrder = await models.PurchaseOrder.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(ownerId) },
      { 
        $set: updates,
        $push: { editHistory: historyEntry }
      },
      { new: true }
    )

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      purchaseOrder,
      message: 'Purchase order updated successfully'
    })
  } catch (error: any) {
    console.error('Update PO error:', error)
    return NextResponse.json(
      { error: 'Failed to update purchase order', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const params = await context.params
    const { id } = params

    // Only allow deletion of draft POs
    const purchaseOrder = await models.PurchaseOrder.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(ownerId),
      status: 'draft'
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found or cannot be deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete PO error:', error)
    return NextResponse.json(
      { error: 'Failed to delete purchase order', details: error.message },
      { status: 500 }
    )
  }
}
