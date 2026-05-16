import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await req.json()

    console.log('Creating KDS order:', { ownerId, body })

    // Generate order number
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = await models.KitchenOrder.countDocuments({ 
      userId: ownerId, 
      createdAt: { $gte: todayStart } 
    })
    const orderNumber = `#${String(todayCount + 1).padStart(3, '0')}`

    // Get waiter name from payload
    const waiterName = payload.type === 'staff' 
      ? (payload.name || 'Staff') 
      : (payload.shopName || 'Owner')

    // Create order
    const order = await models.KitchenOrder.create({
      userId: ownerId,
      orderNumber,
      tableNumber: body.tableNumber,
      tableSection: body.tableSection,
      waiterName,
      waiterId: payload.userId,
      coverCount: body.coverCount || 1,
      orderType: body.orderType || 'dine-in',
      items: body.items,
      status: 'pending',
      priority: body.priority || 'normal',
      specialInstructions: body.notes,
      createdAt: new Date(),
    })

    console.log('Order created:', order._id)

    return NextResponse.json({ 
      success: true,
      order: { ...order.toObject(), id: order._id.toString() } 
    }, { status: 201 })
  } catch (err) {
    console.error('KDS create order error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack')
    return NextResponse.json({ 
      error: 'Failed to create order',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
