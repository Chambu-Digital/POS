import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.reports']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { searchParams } = new URL(request.url)
    
    const startDate = new Date(searchParams.get('startDate') || new Date().toISOString())
    const endDate = new Date(searchParams.get('endDate') || new Date().toISOString())

    const orders = await models.HospitalityOrder.find({
      tenantId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    }).lean()

    // Calculate summary statistics
    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Sales by payment method
    const paymentMethods: Record<string, number> = {}
    orders.forEach(order => {
      paymentMethods[order.paymentMethod] = (paymentMethods[order.paymentMethod] || 0) + order.total
    })

    // Sales by order type
    const orderTypes: Record<string, number> = {}
    orders.forEach(order => {
      orderTypes[order.orderType] = (orderTypes[order.orderType] || 0) + order.total
    })

    // Top selling items
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {}
    orders.forEach(order => {
      order.items.forEach((item: any) => {
        if (!itemSales[item.menuItemId]) {
          itemSales[item.menuItemId] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          }
        }
        itemSales[item.menuItemId].quantity += item.quantity
        itemSales[item.menuItemId].revenue += item.totalPrice
      })
    })

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return NextResponse.json({
      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        period: { startDate, endDate }
      },
      paymentMethods,
      orderTypes,
      topItems
    })
  } catch (error) {
    console.error('[hospitality/reports/sales GET]', error)
    return NextResponse.json({ error: 'Failed to generate sales report' }, { status: 500 })
  }
}
