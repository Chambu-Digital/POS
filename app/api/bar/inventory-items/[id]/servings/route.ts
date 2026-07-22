import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const servings = await models.BarServing.find({
      inventoryItemId: params.id,
      userId: ownerId,
      isActive: true
    }).sort({ createdAt: 1 }).lean()

    return NextResponse.json({ servings })
  } catch (error) {
    console.error('[bar/inventory-items/[id]/servings] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch servings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const body = await request.json()
    const { name, unitsProduced, sellingPrice, branchId } = body

    if (!name || unitsProduced === undefined || sellingPrice === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serving = await models.BarServing.create({
      userId: ownerId,
      branchId: branchId,
      inventoryItemId: params.id,
      name,
      unitsProduced,
      sellingPrice,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return NextResponse.json({ serving }, { status: 201 })
  } catch (error) {
    console.error('[bar/inventory-items/[id]/servings] POST error:', error)
    return NextResponse.json({ error: 'Failed to create serving' }, { status: 500 })
  }
}
