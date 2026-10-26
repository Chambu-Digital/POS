import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { Types } from 'mongoose'

export async function POST(
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
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      paymentMethod,
      bankProviderId,
      bankProviderName,
      customMethodId,
      customMethodName,
      paymentReference,
    } = body

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    const receipt = await (models as any).StockReceipt.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(ownerId),
    })

    if (!receipt) {
      return NextResponse.json({ error: 'Stock receipt not found' }, { status: 404 })
    }

    if (receipt.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'This receipt is already paid' }, { status: 400 })
    }

    receipt.paymentStatus = 'paid'
    receipt.paymentMethod = paymentMethod
    receipt.bankProviderId = bankProviderId ? new Types.ObjectId(bankProviderId) : null
    receipt.bankProviderName = bankProviderName || ''
    receipt.customMethodId = customMethodId ? new Types.ObjectId(customMethodId) : null
    receipt.customMethodName = customMethodName || ''
    receipt.paymentReference = paymentReference || ''
    receipt.paidAt = new Date()
    receipt.settledBy = new Types.ObjectId(payload.userId)
    receipt.settledByModel = payload.type === 'staff' ? 'Staff' : 'User'
    receipt.updatedAt = new Date()
    await receipt.save()

    const serialized = {
      ...receipt.toObject(),
      _id: receipt._id.toString(),
      userId: receipt.userId.toString(),
      branchId: receipt.branchId?.toString() || null,
      supplierId: receipt.supplierId?.toString() || null,
      createdBy: receipt.createdBy?.toString() || null,
    }

    return NextResponse.json({ success: true, receipt: serialized })
  } catch (error: any) {
    console.error('Pay stock receipt error:', error)
    return NextResponse.json(
      { error: 'Failed to settle payable', details: error.message },
      { status: 500 }
    )
  }
}
