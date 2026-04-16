import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const sales = await models.Sale.find({ userId: ownerId })
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ sales })
  } catch (error) {
    console.error('[sales] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    for (const item of data.items) {
      if (item.productId) {
        await models.Product.findByIdAndUpdate(
          new Types.ObjectId(item.productId),
          { $inc: { stock: -item.quantity } }
        )
      }
    }

    const sale = new models.Sale({
      ...data,
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
    })
    await sale.save()
    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[sales] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create sale' }, { status: 500 })
  }
}
