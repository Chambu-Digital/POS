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
    const { id } = params

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid receipt ID' },
        { status: 400 }
      )
    }

    const receipt = await (models as any).StockReceipt
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(ownerId) })
      .lean()

    if (!receipt) {
      return NextResponse.json(
        { error: 'Stock receipt not found' },
        { status: 404 }
      )
    }

    const serialized = {
      ...receipt,
      _id: receipt._id.toString(),
      userId: receipt.userId.toString(),
      branchId: receipt.branchId?.toString() || null,
      supplierId: receipt.supplierId?.toString() || null,
      createdBy: receipt.createdBy?.toString() || null,
    }

    return NextResponse.json({ receipt: serialized })
  } catch (error: any) {
    console.error('Get stock receipt error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock receipt', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/stock-receipts/[id]
// Links an orphaned receipt to a supplier record (supplierId + supplierName).
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await context.params

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 })
    }

    const body = await request.json()
    const { supplierId } = body

    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return NextResponse.json({ error: 'Valid supplierId is required' }, { status: 400 })
    }

    // Verify supplier belongs to this owner
    const supplier = await models.Supplier.findOne({
      _id: new Types.ObjectId(supplierId),
      userId: ownerId,
    }).lean() as any

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const receipt = await (models as any).StockReceipt.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(ownerId) },
      {
        $set: {
          supplierId:   new Types.ObjectId(supplierId),
          supplierName: supplier.name,
          updatedAt:    new Date(),
        },
      },
      { new: true }
    ).lean()

    if (!receipt) {
      return NextResponse.json({ error: 'Stock receipt not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      receipt: {
        ...receipt,
        _id:        receipt._id.toString(),
        userId:     receipt.userId.toString(),
        branchId:   receipt.branchId?.toString() || null,
        supplierId: receipt.supplierId?.toString() || null,
      },
    })
  } catch (error: any) {
    console.error('[stock-receipts/id] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to link supplier', details: error.message }, { status: 500 })
  }
}
