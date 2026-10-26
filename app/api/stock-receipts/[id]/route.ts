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
