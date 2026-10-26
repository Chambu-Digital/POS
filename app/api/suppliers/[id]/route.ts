import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { Types } from 'mongoose'

// ── helpers ───────────────────────────────────────────────────────────────────
function resolveMethodName(r: any): string {
  if (r.paymentMethod === 'cash') return 'Cash'
  if (r.paymentMethod === 'mobile_money') return 'M-Pesa'
  if (r.paymentMethod === 'bank' && r.bankProviderName) return r.bankProviderName
  if (r.paymentMethod === 'custom' && r.customMethodName) return r.customMethodName
  return r.paymentMethod || ''
}

// ── GET /api/suppliers/[id] ───────────────────────────────────────────────────
export async function GET(
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
      return NextResponse.json({ error: 'Invalid supplier ID' }, { status: 400 })
    }

    const supplier = await models.Supplier.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    }).lean() as any

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // All stock receipts for this supplier
    const receipts = await (models as any).StockReceipt.find({
      userId: ownerId,
      supplierId: new Types.ObjectId(id),
    }).sort({ createdAt: -1 }).lean()

    // Balance breakdown
    const unpaid   = receipts.filter((r: any) => r.paymentStatus === 'unpaid')
    const prepaid  = receipts.filter((r: any) => r.paymentStatus === 'prepaid')
    const paid     = receipts.filter((r: any) => r.paymentStatus === 'paid')

    const totalOwed      = unpaid.reduce((s: number, r: any) => s + r.totalCost, 0)
    const totalAdvances  = prepaid.reduce((s: number, r: any) => s + r.totalCost, 0)
    const totalPurchased = paid.reduce((s: number, r: any) => s + r.totalCost, 0)

    const serializedReceipts = receipts.map((r: any) => ({
      _id:              r._id.toString(),
      receiptNumber:    r.receiptNumber,
      date:             r.date,
      paidAt:           r.paidAt || null,
      paymentStatus:    r.paymentStatus,
      paymentMethod:    resolveMethodName(r),
      paymentReference: r.paymentReference || '',
      itemCount:        r.items?.length || 0,
      totalUnits:       (r.items || []).reduce((s: number, i: any) => s + i.quantity, 0),
      totalCost:        r.totalCost,
      reference:        r.reference || '',
      notes:            r.notes || '',
    }))

    return NextResponse.json({
      supplier: {
        ...supplier,
        _id: supplier._id.toString(),
        userId: supplier.userId.toString(),
      },
      balance: {
        totalOwed,
        totalAdvances,
        totalPurchased,
        netPosition: totalOwed - totalAdvances,
      },
      receipts: serializedReceipts,
    })
  } catch (error: any) {
    console.error('[suppliers/id] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch supplier', details: error.message }, { status: 500 })
  }
}

// ── PUT /api/suppliers/[id] ───────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await context.params
    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const supplier = await models.Supplier.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: ownerId },
      {
        $set: {
          name:          body.name.trim(),
          contactPerson: body.contactPerson?.trim() || '',
          phone:         body.phone?.trim() || '',
          email:         body.email?.trim() || '',
          address:       body.address?.trim() || '',
          notes:         body.notes?.trim() || '',
          updatedAt:     new Date(),
        }
      },
      { new: true }
    )

    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

    return NextResponse.json({ supplier })
  } catch (error: any) {
    console.error('[suppliers/id] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

// ── DELETE /api/suppliers/[id] ────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await context.params

    // Soft delete — mark inactive rather than hard delete
    const supplier = await models.Supplier.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: ownerId },
      { $set: { isActive: false, updatedAt: new Date() } },
      { new: true }
    )

    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[suppliers/id] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
