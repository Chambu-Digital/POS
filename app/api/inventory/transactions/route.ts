import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { getInventoryHistory } from '@/lib/inventory-service'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const drugId = searchParams.get('drugId')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    const transactions = await getInventoryHistory(models, ownerId, branchId, drugId || undefined, limit)
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('[inventory/transactions GET]', error)
    return NextResponse.json({ error: 'Failed to fetch inventory transactions' }, { status: 500 })
  }
}
