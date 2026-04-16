import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import mongoose from 'mongoose'

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const view   = searchParams.get('view')

    const query: Record<string, unknown> = { userId: ownerId }
    if (!status || status !== 'collected') {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      query.$or = [{ status: { $ne: 'collected' } }, { collectedAt: { $gte: twoHoursAgo } }]
    }
    if (status) query.status = status
    if (view === 'chef') query.status = { $in: ['pending', 'acknowledged', 'preparing', 'ready'] }
    else if (view === 'waiter') query.status = { $in: ['preparing', 'ready', 'collected'] }

    const orders = await models.KitchenOrder.find(query).sort({ createdAt: -1 }).lean()
    const pw: Record<string, number> = { vip: 0, rush: 1, normal: 2 }
    orders.sort((a: any, b: any) => {
      const p = (pw[a.priority] ?? 2) - (pw[b.priority] ?? 2)
      return p !== 0 ? p : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    const normalized = orders.map((o: any) => ({ ...o, id: o._id.toString(), _id: undefined }))
    return NextResponse.json({ orders: normalized, total: normalized.length })
  } catch (err) {
    console.error('KDS GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await req.json()

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayCount = await models.KitchenOrder.countDocuments({ userId: ownerId, createdAt: { $gte: todayStart } })
    const orderNumber = `#${String(todayCount + 1).padStart(3, '0')}`

    const order = await models.KitchenOrder.create({ ...body, userId: ownerId, orderNumber, status: 'pending' })
    return NextResponse.json({ order: { ...order.toObject(), id: order._id.toString() } }, { status: 201 })
  } catch (err) {
    console.error('KDS POST error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { orderId, status, totalAmount } = await req.json()
    if (!orderId || !status) return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 })

    const validTransitions: Record<string, string[]> = {
      pending: ['acknowledged'], acknowledged: ['preparing'],
      preparing: ['ready'], ready: ['collected'], collected: [],
    }

    const order = await models.KitchenOrder.findOne({ _id: orderId, userId: ownerId })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (!validTransitions[order.status]?.includes(status)) {
      return NextResponse.json({ error: `Cannot transition from ${order.status} to ${status}` }, { status: 422 })
    }

    const now = new Date()
    order.status = status
    if (status === 'acknowledged') order.acknowledgedAt = now
    if (status === 'preparing')    order.preparingAt    = now
    if (status === 'ready')        order.readyAt        = now
    if (status === 'collected') {
      order.collectedAt = now
      if (totalAmount) order.totalAmount = totalAmount
      try {
        const KDS_PLACEHOLDER_ID = new mongoose.Types.ObjectId('000000000000000000000002')
        const saleTotal = totalAmount || order.totalAmount || 0
        const saleItems = (order.items || []).map((item: any) => ({
          productId: KDS_PLACEHOLDER_ID, productName: item.name, quantity: item.quantity,
          price: saleTotal > 0 && order.items.length > 0
            ? parseFloat((saleTotal / order.items.reduce((s: number, i: any) => s + i.quantity, 0)).toFixed(2)) : 0,
          discount: 0,
        }))
        await models.Sale.create({
          userId: ownerId, items: saleItems, subtotal: saleTotal, discount: 0, total: saleTotal,
          paymentMethod: 'cash', notes: `KDS Order ${order.orderNumber} — Table ${order.tableNumber}`,
          source: 'kds', status: 'completed', synced: true,
        })
      } catch (saleErr) { console.error('KDS: failed to create Sale record:', saleErr) }
    }

    await order.save()
    return NextResponse.json({ order: { ...order.toObject(), id: order._id.toString() } })
  } catch (err) {
    console.error('KDS PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

