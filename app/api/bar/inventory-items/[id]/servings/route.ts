import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    console.log('[Servings API] params.id:', id)
    console.log('[Servings API] ownerId:', ownerId)
    console.log('[Servings API] ObjectId conversion:', new Types.ObjectId(id))

    // First, try to find all servings for this user to debug
    const allUserServings = await models.BarServing.find({ userId: ownerId }).lean()
    console.log('[Servings API] All servings for user:', allUserServings.length)
    console.log('[Servings API] All servings data:', JSON.stringify(allUserServings, null, 2))

    // Check if any servings have the inventoryItemId we're looking for
    const targetId = new Types.ObjectId(id)
    const matchingServings = allUserServings.filter((s: any) =>
      s.inventoryItemId && s.inventoryItemId.toString() === targetId.toString()
    )
    console.log('[Servings API] Servings matching inventoryItemId:', matchingServings.length)
    console.log('[Servings API] Matching servings data:', JSON.stringify(matchingServings, null, 2))

    // Try both ObjectId and string query
    const objectQuery = {
      inventoryItemId: targetId,
      userId: ownerId,
      isActive: true
    }
    console.log('[Servings API] ObjectId Query:', objectQuery)

    const objectIdResult = await models.BarServing.find(objectQuery).sort({ createdAt: 1 }).lean()
    console.log('[Servings API] ObjectId query result:', objectIdResult.length)

    // Try string query as fallback
    const stringQuery = {
      inventoryItemId: id,
      userId: ownerId,
      isActive: true
    }
    console.log('[Servings API] String Query:', stringQuery)

    const stringResult = await models.BarServing.find(stringQuery).sort({ createdAt: 1 }).lean()
    console.log('[Servings API] String query result:', stringResult.length)

    const servings = objectIdResult.length > 0 ? objectIdResult : stringResult

    console.log('[Servings API] Found servings:', servings.length)
    console.log('[Servings API] Servings data:', JSON.stringify(servings, null, 2))

    return NextResponse.json({ servings, debug: { allUserServings } })
  } catch (error) {
    console.error('[bar/inventory-items/[id]/servings] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch servings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    const body = await request.json()
    const { name, unitsProduced, sellingPrice, branchId } = body

    if (!name || unitsProduced === undefined || sellingPrice === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serving = await models.BarServing.create({
      userId: ownerId,
      branchId: branchId,
      inventoryItemId: id,
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
