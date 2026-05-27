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
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''

    const query: any = { userId: ownerId, isActive: true }
    if (search) query.$or = [
      { genericName: { $regex: search, $options: 'i' } },
      { brandName: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ]
    if (category) query.category = category

    const drugs = await models.Drug.find(query).sort({ genericName: 1 }).lean()
    return NextResponse.json({ drugs })
  } catch (error) {
    console.error('[pharmacy/drugs GET]', error)
    return NextResponse.json({ error: 'Failed to fetch drugs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await request.json()

    if (!body.genericName || body.sellingPrice === undefined || body.buyingPrice === undefined) {
      return NextResponse.json({ error: 'genericName, sellingPrice, buyingPrice are required' }, { status: 400 })
    }

    const drug = new models.Drug({ ...body, userId: ownerId })
    await drug.save()
    return NextResponse.json({ drug }, { status: 201 })
  } catch (error) {
    console.error('[pharmacy/drugs POST]', error)
    return NextResponse.json({ error: 'Failed to create drug' }, { status: 500 })
  }
}
