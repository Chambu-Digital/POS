import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const body = await request.json()

    const serving = await models.BarServing.findOne({ _id: params.id, userId: ownerId })
    if (!serving) return NextResponse.json({ error: 'Serving not found' }, { status: 404 })

    if (body.name !== undefined) serving.name = body.name
    if (body.unitsProduced !== undefined) serving.unitsProduced = body.unitsProduced
    if (body.sellingPrice !== undefined) serving.sellingPrice = body.sellingPrice
    if (body.isActive !== undefined) serving.isActive = body.isActive

    serving.updatedAt = new Date()
    await serving.save()

    return NextResponse.json({ serving })
  } catch (error) {
    console.error('[bar/servings/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update serving' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const serving = await models.BarServing.findOne({ _id: params.id, userId: ownerId })
    if (!serving) return NextResponse.json({ error: 'Serving not found' }, { status: 404 })

    serving.isActive = false
    serving.updatedAt = new Date()
    await serving.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[bar/servings/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete serving' }, { status: 500 })
  }
}
