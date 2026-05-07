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
    const withDebt = searchParams.get('withDebt') === 'true'

    const query: any = { userId: ownerId }
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ]
    if (withDebt) query.creditBalance = { $gt: 0 }

    const customers = await models.Customer.find(query).sort({ name: 1 }).lean()
    return NextResponse.json({ customers })
  } catch (error) {
    console.error('[customers] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { name, phone, email } = await request.json()

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const customer = new models.Customer({ userId: ownerId, name, phone, email })
    await customer.save()
    return NextResponse.json({ customer }, { status: 201 })
  } catch (error) {
    console.error('[customers] POST error:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
