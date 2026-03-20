import { connectDB } from '@/lib/db'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'
import Staff from '@/lib/models/Staff'
import KitchenOrder from '@/lib/models/KitchenOrder'
import User from '@/lib/models/User'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Get date range from query params (default to last 30 days)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch all sales for the owner
    const allSales = await Sale.find({ userId: ownerId })
      .populate('items.productId')
      .lean()

    // Fetch sales within date range
    const recentSales = await Sale.find({
      userId: ownerId,
      createdAt: { $gte: startDate },
    })
      .populate('items.productId')
      .lean()

    // Fetch products
    const products = await Product.find({ userId: ownerId }).lean()

    // Fetch staff count
    const staffCount = await Staff.countDocuments({ userId: ownerId, active: true })

    // Calculate statistics
    const totalSales = allSales.length
    const totalRevenue = allSales.reduce((sum, sale) => sum + sale.total, 0)
    const totalDiscount = allSales.reduce((sum, sale) => sum + (sale.discount || 0), 0)
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0

    // Revenue breakdown by source
    const revenueBySource = {
      pos: allSales.filter((s: any) => !s.source || s.source === 'pos').reduce((sum, s) => sum + s.total, 0),
      bar: allSales.filter((s: any) => s.source === 'bar').reduce((sum, s) => sum + s.total, 0),
      kds: allSales.filter((s: any) => s.source === 'kds').reduce((sum, s) => sum + s.total, 0),
    }

    // Recent period stats
    const recentTotalSales = recentSales.length
    const recentRevenue = recentSales.reduce((sum, sale) => sum + sale.total, 0)
    const recentDiscount = recentSales.reduce((sum, sale) => sum + (sale.discount || 0), 0)
    // Product statistics
    const totalProducts = products.length
    const totalStock = products.reduce((sum, p: any) => sum + p.stock, 0)
    const stockValue = products.reduce((sum, p: any) => sum + (p.stock * p.sellingPrice), 0)
    const lowStockItems = products.filter((p: any) => p.stock < (p.lowStockThreshold || 10)).length
    const outOfStockItems = products.filter((p: any) => p.stock === 0).length

    // Sales by day (last 7 days)
    const last7Days = new Date()
    last7Days.setDate(last7Days.getDate() - 7)
    const salesLast7Days = await Sale.find({
      userId: ownerId,
      createdAt: { $gte: last7Days },
    }).lean()

    const salesByDay: { [key: string]: { date: string; sales: number; revenue: number } } = {}
    salesLast7Days.forEach((sale: any) => {
      const date = new Date(sale.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      if (!salesByDay[date]) {
        salesByDay[date] = { date, sales: 0, revenue: 0 }
      }
      salesByDay[date].sales += 1
      salesByDay[date].revenue += sale.total
    })

    // Top selling products
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {}
    recentSales.forEach((sale: any) => {
      sale.items.forEach((item: any) => {
        const productName = item.productId?.productName || 'Unknown'
        if (!productSales[productName]) {
          productSales[productName] = { name: productName, quantity: 0, revenue: 0 }
        }
        productSales[productName].quantity += item.quantity
        productSales[productName].revenue += item.price * item.quantity
      })
    })

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Payment method breakdown
    const paymentMethods: { [key: string]: { method: string; count: number; total: number } } = {}
    recentSales.forEach((sale: any) => {
      const method = sale.paymentMethod || 'cash'
      if (!paymentMethods[method]) {
        paymentMethods[method] = { method, count: 0, total: 0 }
      }
      paymentMethods[method].count += 1
      paymentMethods[method].total += sale.total
    })

    // Recent orders (last 10)
    const recentOrders = await Sale.find({ userId: ownerId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('items.productId')
      .populate('staffId', 'name')
      .lean()

    // ── KDS stats (today) — only if feature is enabled ───────────────────────
    const user = await User.findById(ownerId).lean() as { settings?: { features?: { kdsEnabled?: boolean } } } | null
    const kdsEnabled = user?.settings?.features?.kdsEnabled === true

    let kdsStats = null
    if (kdsEnabled) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

      const todayOrders = await KitchenOrder.find({
        userId: ownerId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }).lean()

      const completed = todayOrders.filter(o => o.status === 'collected')
      const active    = todayOrders.filter(o => o.status !== 'collected')

      // Avg prep time (preparingAt → readyAt)
      const prepTimes = completed
        .filter(o => o.preparingAt && o.readyAt)
        .map(o => (new Date(o.readyAt!).getTime() - new Date(o.preparingAt!).getTime()) / 60000)
      const avgPrepMins = prepTimes.length
        ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
        : 0

      // Unique tables served today
      const tablesServed = new Set(todayOrders.map(o => o.tableNumber)).size

      // Revenue from collected orders
      const kdsRevenue = completed.reduce((s, o) => s + (o.totalAmount ?? 0), 0)

      // Recent 5 kitchen orders
      const recentKitchenOrders = await KitchenOrder.find({ userId: ownerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()

      kdsStats = {
        todayTotal:    todayOrders.length,
        todayCompleted: completed.length,
        todayActive:   active.length,
        tablesServed,
        avgPrepMins,
        kdsRevenue,
        recentKitchenOrders: recentKitchenOrders.map(o => ({
          ...o,
          id: o._id.toString(),
        })),
      }
    }

    return NextResponse.json({
      stats: {
        // Overall statistics
        totalSales,
        totalRevenue,
        totalDiscount,
        averageSaleValue,
        revenueBySource,

        // Recent period statistics
        recentPeriod: {
          days,
          totalSales: recentTotalSales,
          revenue: recentRevenue,
          discount: recentDiscount,
        },

        // Product statistics
        products: {
          total: totalProducts,
          totalStock,
          stockValue,
          lowStockItems,
          outOfStockItems,
        },

        // Staff count
        staffCount,

        // Charts data
        charts: {
          salesByDay: Object.values(salesByDay),
          topProducts,
          paymentMethods: Object.values(paymentMethods),
        },

        // Recent orders
        recentOrders,

        // KDS stats (null if KDS not enabled)
        kdsEnabled,
        kdsStats,
      },
    })
  } catch (error) {
    console.error('[Dashboard Stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
