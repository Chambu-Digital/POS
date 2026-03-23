import { connectDB } from '@/lib/db'
import RentalService from '@/lib/models/RentalService'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active') !== 'false'

    const query: Record<string, unknown> = { userId: ownerId }
    if (category && category !== 'all') query.category = category
    if (activeOnly) query.isActive = true

    const services = await RentalService.find(query).sort({ category: 1, name: 1 }).lean()
    return NextResponse.json({ services })
  } catch (error) {
    console.error('[RentalServices] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const data = await request.json()

    if (!data.name?.trim()) return NextResponse.json({ error: 'Service name is required' }, { status: 400 })
    if (!data.category) return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    if (!data.pricing?.length) return NextResponse.json({ error: 'At least one pricing tier is required' }, { status: 400 })

    const service = new RentalService({ ...data, userId: ownerId })
    await service.save()
    return NextResponse.json({ service }, { status: 201 })
  } catch (error) {
    console.error('[RentalServices] POST error:', error)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
