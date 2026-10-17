import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const data = await request.json()
    const { status, paymentMethod, paymentDate, receiptNumber, bankProviderId, bankProviderName, customMethodId, customMethodName, mpesaCode, mpesaPhone } = data

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Validate payment method if provided
    if (paymentMethod && !['cash', 'card', 'mobile_money', 'bank', 'custom', ''].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    // Build update object
    const updateData: any = {
      status,
      approvedBy: payload.userId,
      approvedAt: new Date(),
    }

    // If approving and payment details provided, record payment
    if (status === 'approved' && paymentMethod) {
      updateData.paymentMethod = paymentMethod
      updateData.paymentDate = paymentDate ? new Date(paymentDate) : new Date()
      updateData.paidBy = payload.userId // Owner approved and paid
      
      if (receiptNumber) updateData.receiptNumber = receiptNumber
      if (bankProviderId) updateData.bankProviderId = bankProviderId
      if (bankProviderName) updateData.bankProviderName = bankProviderName
      if (customMethodId) updateData.customMethodId = customMethodId
      if (customMethodName) updateData.customMethodName = customMethodName
      if (mpesaCode) updateData.mpesaCode = mpesaCode
      if (mpesaPhone) updateData.mpesaPhone = mpesaPhone
    }

    const expense = await models.Expense.findOneAndUpdate(
      { _id: id, userId: payload.userId },
      { $set: updateData },
      { new: true }
    )
    
    if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ expense })
  } catch (error) {
    console.error('[expense] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    await models.Expense.findOneAndDelete({ _id: id, userId: ownerId })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[expense] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
