import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { reconstructInventory } from '@/lib/inventory-service'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only business owners can reconstruct inventory
    if (payload.type === 'staff') {
      return NextResponse.json({ error: 'Only business owners can reconstruct inventory' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const body = await request.json()
    const { branchId, drugId } = body

    if (!branchId || !drugId) {
      return NextResponse.json({ error: 'branchId and drugId are required' }, { status: 400 })
    }

    const balance = await reconstructInventory(models, payload.userId, branchId, drugId)

    return NextResponse.json({ 
      success: true, 
      message: 'Inventory reconstructed successfully',
      reconstructedBalance: balance 
    })
  } catch (error) {
    console.error('[inventory/reconstruct POST]', error)
    return NextResponse.json({ error: 'Failed to reconstruct inventory' }, { status: 500 })
  }
}
