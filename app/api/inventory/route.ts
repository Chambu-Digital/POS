import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const drugId = searchParams.get('drugId')

    const query: any = { userId: ownerId }
    if (branchId) query.branchId = branchId
    if (drugId) query.drugId = drugId

    const inventory = await models.Inventory
      .find(query)
      .populate('drugId', 'genericName brandName category unit barcode')
      .populate('branchId', 'name code')
      .sort({ lastStockUpdate: -1 })
      .lean()

    return NextResponse.json({ inventory })
  } catch (error) {
    console.error('[inventory GET]', error)
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  }
}
