import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { normalisePermissions } from '@/lib/modules'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const isStaff = payload.type === 'staff'
    const ownerId = isStaff && payload.adminId ? payload.adminId : payload.userId
    const perms = isStaff ? normalisePermissions(payload.permissions || {}) : null

    const canSeeReports   = !isStaff || perms?.['pos.reports'] === true
    const canSeeInventory = !isStaff || perms?.['pos.inventory'] === true

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const staffFilter = isStaff ? { staffId: payload.userId } : {}

    const todaySales = await models.Sale.find({
      userId: ownerId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      ...staffFilter,
    }).lean()

    const todayStats = {
      totalOrders: todaySales.length,
      totalRevenue: todaySales.reduce((s, x) => s + x.total, 0),
      bySource: {
        pos:    todaySales.filter((s: any) => !s.source || s.source === 'pos').reduce((sum, s) => sum + s.total, 0),
        bar:    todaySales.filter((s: any) => s.source === 'bar').reduce((sum, s) => sum + s.total, 0),
        kds:    todaySales.filter((s: any) => s.source === 'kds').reduce((sum, s) => sum + s.total, 0),
        rental: todaySales.filter((s: any) => s.source === 'rental').reduce((sum, s) => sum + s.total, 0),
      },
      byPayment: todaySales.reduce((acc: Record<string, number>, s: any) => {
        const m = s.paymentMethod || 'cash'
        acc[m] = (acc[m] || 0) + s.total
        return acc
      }, {}),
    }

    // Staff without reports permission — minimal response only
    if (isStaff && !canSeeReports) {
      const recentOrders = await models.Sale.find({ userId: ownerId, staffId: payload.userId })
        .sort({ createdAt: -1 }).limit(10).lean()

      return NextResponse.json({
        stats: {
          isStaffView: true,
          todayStats,
          recentOrders,
          products: canSeeInventory ? {
            total: await models.Product.countDocuments({ userId: ownerId }),
            lowStockItems: await models.Product.countDocuments({
              userId: ownerId,
              $expr: { $lt: ['$stock', { $ifNull: ['$lowStockThreshold', 10] }] },
            }),
            stockValue: 0, totalStock: 0, outOfStockItems: 0,
          } : null,
        },
      })
    }

    // Full stats for owner or staff with reports permission
    const allSales = await models.Sale.find({ userId: ownerId }).lean()
    const recentSales = await models.Sale.find({ userId: ownerId, createdAt: { $gte: startDate } })
      .populate('items.productId').lean()

    const products = await models.Product.find({ userId: ownerId }).lean()
    const staffCount = await models.Staff.countDocuments({ userId: ownerId, active: true })

    const totalSales = allSales.length
    const totalRevenue = allSales.reduce((sum, s) => sum + s.total, 0)
    const totalDiscount = allSales.reduce((sum, s) => sum + (s.discount || 0), 0)
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0

    const revenueBySource = {
      pos:    recentSales.filter((s: any) => !s.source || s.source === 'pos').reduce((sum, s) => sum + s.total, 0),
      bar:    recentSales.filter((s: any) => s.source === 'bar').reduce((sum, s) => sum + s.total, 0),
      kds:    recentSales.filter((s: any) => s.source === 'kds').reduce((sum, s) => sum + s.total, 0),
      rental: recentSales.filter((s: any) => s.source === 'rental').reduce((sum, s) => sum + s.total, 0),
    }

    const salesByDay: Record<string, { date: string; sales: number; revenue: number }> = {}
    const last7Days = new Date(); last7Days.setDate(last7Days.getDate() - 7)
    const salesLast7 = await models.Sale.find({ userId: ownerId, createdAt: { $gte: last7Days } }).lean()
    salesLast7.forEach((sale: any) => {
      const date = new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!salesByDay[date]) salesByDay[date] = { date, sales: 0, revenue: 0 }
      salesByDay[date].sales += 1
      salesByDay[date].revenue += sale.total
    })

    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {}
    recentSales.forEach((sale: any) => {
      sale.items.forEach((item: any) => {
        const name = item.productId?.productName || 'Unknown'
        if (!productSales[name]) productSales[name] = { name, quantity: 0, revenue: 0 }
        productSales[name].quantity += item.quantity
        productSales[name].revenue += item.price * item.quantity
      })
    })

    const paymentMethods: Record<string, { method: string; count: number; total: number }> = {}
    recentSales.forEach((sale: any) => {
      const method = sale.paymentMethod || 'cash'
      if (!paymentMethods[method]) paymentMethods[method] = { method, count: 0, total: 0 }
      paymentMethods[method].count += 1
      paymentMethods[method].total += sale.total
    })

    const recentOrders = await models.Sale.find({ userId: ownerId })
      .sort({ createdAt: -1 }).limit(10)
      .populate('items.productId').populate('staffId', 'name').lean()

    const rentalBookings = await models.RentalBooking.find({ userId: ownerId }).lean()
    const rentalRevenue = rentalBookings
      .filter((b: any) => b.status === 'completed')
      .reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0)

    const kStart = new Date(); kStart.setHours(0, 0, 0, 0)
    const kEnd   = new Date(); kEnd.setHours(23, 59, 59, 999)
    const todayKitchenOrders = await models.KitchenOrder.find({ userId: ownerId, createdAt: { $gte: kStart, $lte: kEnd } }).lean()
    const completedKds = todayKitchenOrders.filter(o => o.status === 'collected')
    const prepTimes = completedKds
      .filter(o => o.preparingAt && o.readyAt)
      .map(o => (new Date(o.readyAt!).getTime() - new Date(o.preparingAt!).getTime()) / 60000)
    const recentKitchenOrders = await models.KitchenOrder.find({ userId: ownerId }).sort({ createdAt: -1 }).limit(5).lean()

    return NextResponse.json({
      stats: {
        isStaffView: false,
        totalSales, totalRevenue, totalDiscount, averageSaleValue, revenueBySource,
        recentPeriod: {
          days,
          totalSales: recentSales.length,
          revenue: recentSales.reduce((s, x) => s + x.total, 0),
          discount: recentSales.reduce((s, x) => s + ((x as any).discount || 0), 0),
        },
        products: {
          total: products.length,
          totalStock: products.reduce((s, p: any) => s + p.stock, 0),
          stockValue: products.reduce((s, p: any) => s + (p.stock * p.sellingPrice), 0),
          lowStockItems: products.filter((p: any) => p.stock < (p.lowStockThreshold || 10)).length,
          outOfStockItems: products.filter((p: any) => p.stock === 0).length,
        },
        staffCount,
        charts: {
          salesByDay: Object.values(salesByDay),
          topProducts: Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
          paymentMethods: Object.values(paymentMethods),
        },
        recentOrders,
        todayStats,
        rentalStats: {
          totalBookings: rentalBookings.length,
          activeRentals: rentalBookings.filter((b: any) => b.status === 'active' || b.status === 'overdue').length,
          completedRentals: rentalBookings.filter((b: any) => b.status === 'completed').length,
          rentalRevenue,
        },
        kdsStats: {
          todayTotal: todayKitchenOrders.length,
          todayCompleted: completedKds.length,
          todayActive: todayKitchenOrders.filter(o => o.status !== 'collected').length,
          tablesServed: new Set(todayKitchenOrders.map(o => o.tableNumber)).size,
          avgPrepMins: prepTimes.length ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : 0,
          recentKitchenOrders: recentKitchenOrders.map(o => ({ ...o, id: o._id.toString() })),
        },
      },
    })
  } catch (error) {
    console.error('[Dashboard Stats] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard statistics' }, { status: 500 })
  }
}
