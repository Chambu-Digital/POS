import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const date = searchParams.get('date')

    const query: any = { userId: ownerId }
    if (status) query.paymentStatus = status
    if (supplierId) query.supplierId = supplierId
    // Scope to the current branch when a branch context is active
    if (branchContext) query.branchId = new Types.ObjectId(branchContext)
    if (date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      query.date = { $gte: start, $lte: end }
    }

    const receipts = await (models as any).StockReceipt
      .find(query)
      .sort({ createdAt: -1 })
      .lean()
      .then((docs: any[]) => docs.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
        userId: doc.userId.toString(),
        branchId: doc.branchId?.toString() || null,
        supplierId: doc.supplierId?.toString() || null,
        createdBy: doc.createdBy?.toString() || null,
      })))

    return NextResponse.json({ receipts })
  } catch (error: any) {
    console.error('List stock receipts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock receipts', details: error.message },
      { status: 500 }
    )
  }
}
