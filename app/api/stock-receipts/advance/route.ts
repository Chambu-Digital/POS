// POST /api/stock-receipts/advance
// Records an advance payment to a supplier — cash goes out today,
// goods arrive later. Creates a StockReceipt with paymentStatus='prepaid'
// and no items yet. Items are linked when goods arrive via the /receive route.

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { Types } from 'mongoose'

function generateReceiptNumber(lastNumber: string | null): string {
  const currentYear = new Date().getFullYear()
  if (!lastNumber) return `SR-${currentYear}-0001`
  const match = lastNumber.match(/^SR-(\d{4})-(\d+)$/)
  if (!match) return `SR-${currentYear}-0001`
  const lastYear = parseInt(match[1])
  const lastNum = parseInt(match[2])
  if (lastYear < currentYear) return `SR-${currentYear}-0001`
  return `SR-${currentYear}-${(lastNum + 1).toString().padStart(4, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null
    const branchContext = await getBranchContext(request)

    const body = await request.json()
    const {
      supplierId,
      supplierName: supplierNameBody,
      amount,
      paymentMethod,
      bankProviderId,
      bankProviderName,
      customMethodId,
      customMethodName,
      paymentReference,
      notes,
    } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    // Resolve supplier name — either from a supplier record or free text
    let resolvedSupplierName = supplierNameBody || 'Unknown Supplier'
    if (supplierId && Types.ObjectId.isValid(supplierId)) {
      const supplier = await models.Supplier.findOne({
        _id: new Types.ObjectId(supplierId),
        userId: ownerId,
      }).lean() as any
      if (supplier) resolvedSupplierName = supplier.name
    }

    // Generate receipt number
    const lastReceipt = await (models as any).StockReceipt
      .findOne({ userId: ownerId })
      .sort({ createdAt: -1 })
      .select('receiptNumber')
      .lean() as any

    const receiptNumber = generateReceiptNumber(lastReceipt?.receiptNumber || null)

    const receipt = await (models as any).StockReceipt.create({
      userId:          ownerId,
      branchId:        branchContext ? new Types.ObjectId(branchContext) : null,
      receiptNumber,
      date:            new Date(),
      supplierId:      supplierId && Types.ObjectId.isValid(supplierId) ? new Types.ObjectId(supplierId) : null,
      supplierName:    resolvedSupplierName,
      reference:       notes || '',
      items:           [],  // no items yet — goods pending
      totalCost:       amount,
      paymentStatus:   'prepaid',
      paymentMethod,
      bankProviderId:  bankProviderId ? new Types.ObjectId(bankProviderId) : null,
      bankProviderName: bankProviderName || '',
      customMethodId:  customMethodId ? new Types.ObjectId(customMethodId) : null,
      customMethodName: customMethodName || '',
      paymentReference: paymentReference || '',
      paidAt:          new Date(),
      notes:           notes || '',
      createdBy:       staffId ? new Types.ObjectId(staffId) : new Types.ObjectId(ownerId),
      createdByModel:  payload.type === 'staff' ? 'Staff' : 'User',
    })

    return NextResponse.json({
      success: true,
      receipt: {
        ...receipt.toObject(),
        _id: receipt._id.toString(),
        userId: receipt.userId.toString(),
        branchId: receipt.branchId?.toString() || null,
        supplierId: receipt.supplierId?.toString() || null,
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error('[stock-receipts/advance] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to record advance payment', details: error.message },
      { status: 500 }
    )
  }
}
