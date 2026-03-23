import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/jwt'
import { connectDB } from '@/lib/db'
import Report from '@/lib/models/Report'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'
import KitchenOrder from '@/lib/models/KitchenOrder'
import RentalBooking from '@/lib/models/RentalBooking'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    await connectDB()

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type')

    const query: any = { userId: ownerId }
    if (reportType) {
      query.reportType = reportType
    }

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    await connectDB()

    const body = await request.json()
    const { reportType, startDate, endDate } = body

    if (!reportType || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Report type and date range are required' },
        { status: 400 }
      )
    }

    console.log('[Reports API] Generating report:', {
      reportType,
      ownerId,
      startDate,
      endDate,
    })

    // Check if there are any sales at all for this user
    const totalSalesCount = await Sale.countDocuments({ userId: ownerId })
    console.log('[Reports API] Total sales in database for user:', totalSalesCount)

    // Generate report based on type
    let reportData: any = {}

    if (reportType === 'sales') {
      reportData = await generateSalesReport(ownerId, new Date(startDate), new Date(endDate))
    } else if (reportType === 'inventory') {
      reportData = await generateInventoryReport(ownerId)
    } else if (reportType === 'profit') {
      reportData = await generateProfitReport(ownerId, new Date(startDate), new Date(endDate))
    } else if (reportType === 'kitchen') {
      reportData = await generateKitchenReport(ownerId, new Date(startDate), new Date(endDate))
    } else if (reportType === 'bar') {
      reportData = await generateBarReport(ownerId, new Date(startDate), new Date(endDate))
    } else if (reportType === 'rental') {
      reportData = await generateRentalReport(ownerId, new Date(startDate), new Date(endDate))
    }

    // Save report to database
    const report = await Report.create({
      userId: ownerId,
      reportType,
      title: reportData.title,
      description: reportData.description,
      dateRange: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      data: reportData.data,
      generatedAt: new Date(),
    })

    console.log('[Reports API] Report created:', report._id)

    return NextResponse.json({ report, message: 'Report generated successfully' })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

async function generateSalesReport(userId: string, startDate: Date, endDate: Date) {
  // Set start date to beginning of day
  const adjustedStartDate = new Date(startDate)
  adjustedStartDate.setHours(0, 0, 0, 0)
  
  // Set end date to end of day to include all sales on that day
  const adjustedEndDate = new Date(endDate)
  adjustedEndDate.setHours(23, 59, 59, 999)

  console.log('[Sales Report] Query params:', {
    userId,
    startDate: adjustedStartDate.toISOString(),
    endDate: adjustedEndDate.toISOString(),
  })

  const sales = await Sale.find({
    userId,
    createdAt: { $gte: adjustedStartDate, $lte: adjustedEndDate },
  }).lean()

  console.log('[Sales Report] Found sales:', sales.length)

  // If no sales found in date range, get all sales for this user
  let allSales = sales
  if (sales.length === 0) {
    console.log('[Sales Report] No sales in date range, fetching all sales')
    allSales = await Sale.find({ userId }).lean()
    console.log('[Sales Report] Total sales for user:', allSales.length)
  }

  const totalSales = allSales.length
  const totalRevenue = allSales.reduce((sum, sale) => sum + sale.total, 0)
  const totalDiscount = allSales.reduce((sum, sale) => sum + (sale.discount || 0), 0)
  const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0

  // Source breakdown
  const bySource = {
    pos: allSales.filter((s: any) => !s.source || s.source === 'pos'),
    bar: allSales.filter((s: any) => s.source === 'bar'),
    kds: allSales.filter((s: any) => s.source === 'kds'),
    rental: allSales.filter((s: any) => s.source === 'rental'),
  }
  const sourceBreakdown = {
    pos:    { count: bySource.pos.length,    revenue: bySource.pos.reduce((s, x) => s + x.total, 0) },
    bar:    { count: bySource.bar.length,    revenue: bySource.bar.reduce((s, x) => s + x.total, 0) },
    kds:    { count: bySource.kds.length,    revenue: bySource.kds.reduce((s, x) => s + x.total, 0) },
    rental: { count: bySource.rental.length, revenue: bySource.rental.reduce((s, x) => s + x.total, 0) },
  }

  // Group by day
  const salesByDay = allSales.reduce((acc: any, sale) => {
    const date = new Date(sale.createdAt).toISOString().split('T')[0]
    if (!acc[date]) {
      acc[date] = { date, sales: 0, revenue: 0 }
    }
    acc[date].sales += 1
    acc[date].revenue += sale.total
    return acc
  }, {})

  const dateRangeNote = sales.length === 0 
    ? ` (No sales found in selected range, showing all ${allSales.length} sales)`
    : ''

  return {
    title: 'Sales Report',
    description: `Sales report from ${adjustedStartDate.toLocaleDateString()} to ${adjustedEndDate.toLocaleDateString()}${dateRangeNote}`,
    data: {
      summary: {
        totalSales,
        totalRevenue,
        totalDiscount,
        averageSaleValue,
        posRevenue: sourceBreakdown.pos.revenue,
        barRevenue: sourceBreakdown.bar.revenue,
        kdsRevenue: sourceBreakdown.kds.revenue,
        rentalRevenue: sourceBreakdown.rental.revenue,
      },
      sourceBreakdown,
      details: allSales,
      charts: {
        salesByDay: Object.values(salesByDay),
      },
    },
  }
}

async function generateInventoryReport(userId: string) {
  const products = await Product.find({ userId }).lean() as any[]

  const totalProducts = products.length
  const totalStockValue = products.reduce(
    (sum, p) => sum + (p.stock * (p.costPrice || 0)),
    0
  )
  const lowStockItems = products.filter((p) => p.stock < (p.lowStockThreshold || 10)).length
  const outOfStockItems = products.filter((p) => p.stock === 0).length

  // Group by category
  const byCategory = products.reduce((acc: any, product) => {
    const cat = product.category || 'Uncategorized'
    if (!acc[cat]) {
      acc[cat] = { category: cat, count: 0, value: 0 }
    }
    acc[cat].count += 1
    acc[cat].value += product.stock * (product.costPrice || 0)
    return acc
  }, {})

  return {
    title: 'Inventory Report',
    description: 'Current inventory status',
    data: {
      summary: {
        totalProducts,
        totalStockValue,
        lowStockItems,
        outOfStockItems,
      },
      details: products,
      charts: {
        byCategory: Object.values(byCategory),
      },
    },
  }
}

async function generateProfitReport(userId: string, startDate: Date, endDate: Date) {
  const sales = await Sale.find({
    userId,
    createdAt: { $gte: startDate, $lte: endDate },
  })
    .populate('items.productId')
    .lean() as any[]

  let totalRevenue = 0
  let totalCost = 0

  // Calculate profit from sales
  for (const sale of sales) {
    totalRevenue += sale.total
    // Calculate cost based on items
    for (const item of sale.items) {
      if (item.productId && item.productId.costPrice) {
        totalCost += item.productId.costPrice * item.quantity
      }
    }
  }

  const totalProfit = totalRevenue - totalCost
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  // Source breakdown for profit report
  const sourceRevenue = {
    pos:    sales.filter((s: any) => !s.source || s.source === 'pos').reduce((sum: number, s: any) => sum + s.total, 0),
    bar:    sales.filter((s: any) => s.source === 'bar').reduce((sum: number, s: any) => sum + s.total, 0),
    kds:    sales.filter((s: any) => s.source === 'kds').reduce((sum: number, s: any) => sum + s.total, 0),
    rental: sales.filter((s: any) => s.source === 'rental').reduce((sum: number, s: any) => sum + s.total, 0),
  }

  return {
    title: 'Profit Report',
    description: `Profit analysis from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
    data: {
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        posRevenue: sourceRevenue.pos,
        barRevenue: sourceRevenue.bar,
        kdsRevenue: sourceRevenue.kds,
        rentalRevenue: sourceRevenue.rental,
      },
      details: sales,
      charts: {},
    },
  }
}


async function generateKitchenReport(userId: string, startDate: Date, endDate: Date) {
  const start = new Date(startDate); start.setHours(0, 0, 0, 0)
  const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)

  const orders = await KitchenOrder.find({
    userId,
    createdAt: { $gte: start, $lte: end },
  }).lean() as any[]

  const total     = orders.length
  const completed = orders.filter(o => o.status === 'collected').length
  const pending   = orders.filter(o => ['pending', 'acknowledged', 'preparing', 'ready'].includes(o.status)).length
  const revenue   = orders.filter(o => o.status === 'collected').reduce((s, o) => s + (o.totalAmount || 0), 0)

  // Avg prep time
  const prepTimes = orders
    .filter(o => o.preparingAt && o.readyAt)
    .map(o => (new Date(o.readyAt).getTime() - new Date(o.preparingAt).getTime()) / 60000)
  const avgPrepMins = prepTimes.length
    ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
    : 0

  // Tables served
  const tablesServed = new Set(orders.map(o => o.tableNumber)).size

  // Orders by day
  const byDay: Record<string, { date: string; orders: number; revenue: number }> = {}
  orders.forEach(o => {
    const d = new Date(o.createdAt).toISOString().split('T')[0]
    if (!byDay[d]) byDay[d] = { date: d, orders: 0, revenue: 0 }
    byDay[d].orders += 1
    byDay[d].revenue += o.totalAmount || 0
  })

  // Top items
  const itemCounts: Record<string, { name: string; count: number }> = {}
  orders.forEach(o => {
    (o.items || []).forEach((item: any) => {
      if (!itemCounts[item.name]) itemCounts[item.name] = { name: item.name, count: 0 }
      itemCounts[item.name].count += item.quantity || 1
    })
  })
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 10)

  return {
    title: 'Kitchen Report',
    description: `Kitchen orders from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
    data: {
      summary: { totalOrders: total, completedOrders: completed, pendingOrders: pending, tablesServed, avgPrepMins, totalRevenue: revenue },
      details: orders,
      charts: { byDay: Object.values(byDay), topItems },
    },
  }
}

async function generateBarReport(userId: string, startDate: Date, endDate: Date) {
  const start = new Date(startDate); start.setHours(0, 0, 0, 0)
  const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)

  const sales = await Sale.find({
    userId,
    source: 'bar',
    createdAt: { $gte: start, $lte: end },
  }).lean() as any[]

  const totalOrders  = sales.length
  const totalRevenue = sales.reduce((s, x) => s + x.total, 0)
  const avgOrder     = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Payment breakdown
  const byPayment: Record<string, { method: string; count: number; revenue: number }> = {}
  sales.forEach(s => {
    const m = s.paymentMethod || 'cash'
    if (!byPayment[m]) byPayment[m] = { method: m, count: 0, revenue: 0 }
    byPayment[m].count += 1
    byPayment[m].revenue += s.total
  })

  // By day
  const byDay: Record<string, { date: string; orders: number; revenue: number }> = {}
  sales.forEach(s => {
    const d = new Date(s.createdAt).toISOString().split('T')[0]
    if (!byDay[d]) byDay[d] = { date: d, orders: 0, revenue: 0 }
    byDay[d].orders += 1
    byDay[d].revenue += s.total
  })

  // Top items
  const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {}
  sales.forEach(s => {
    (s.items || []).forEach((item: any) => {
      const name = item.productName || 'Unknown'
      if (!itemCounts[name]) itemCounts[name] = { name, count: 0, revenue: 0 }
      itemCounts[name].count += item.quantity || 1
      itemCounts[name].revenue += (item.price || 0) * (item.quantity || 1)
    })
  })
  const topItems = Object.values(itemCounts).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  return {
    title: 'Bar Report',
    description: `Bar sales from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
    data: {
      summary: { totalOrders, totalRevenue, averageOrderValue: Math.round(avgOrder) },
      details: sales,
      charts: { byDay: Object.values(byDay), topItems, paymentMethods: Object.values(byPayment) },
    },
  }
}

async function generateRentalReport(userId: string, startDate: Date, endDate: Date) {
  const start = new Date(startDate); start.setHours(0, 0, 0, 0)
  const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)

  const bookings = await RentalBooking.find({
    userId,
    createdAt: { $gte: start, $lte: end },
  }).lean() as any[]

  const total     = bookings.length
  const completed = bookings.filter(b => b.status === 'completed').length
  const active    = bookings.filter(b => b.status === 'active' || b.status === 'overdue').length
  const cancelled = bookings.filter(b => b.status === 'cancelled').length
  const revenue   = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0)
  const deposits  = bookings.reduce((s, b) => s + (b.deposit || 0), 0)

  // By category
  const byCategory: Record<string, { category: string; count: number; revenue: number }> = {}
  bookings.forEach(b => {
    const cat = b.serviceCategory || 'other'
    if (!byCategory[cat]) byCategory[cat] = { category: cat, count: 0, revenue: 0 }
    byCategory[cat].count += 1
    byCategory[cat].revenue += b.totalAmount || 0
  })

  // By service
  const byService: Record<string, { name: string; count: number; revenue: number }> = {}
  bookings.forEach(b => {
    const name = b.serviceName || 'Unknown'
    if (!byService[name]) byService[name] = { name, count: 0, revenue: 0 }
    byService[name].count += 1
    byService[name].revenue += b.totalAmount || 0
  })
  const topServices = Object.values(byService).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // By day
  const byDay: Record<string, { date: string; bookings: number; revenue: number }> = {}
  bookings.forEach(b => {
    const d = new Date(b.createdAt).toISOString().split('T')[0]
    if (!byDay[d]) byDay[d] = { date: d, bookings: 0, revenue: 0 }
    byDay[d].bookings += 1
    byDay[d].revenue += b.totalAmount || 0
  })

  return {
    title: 'Rental Services Report',
    description: `Rental bookings from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
    data: {
      summary: { totalBookings: total, completedBookings: completed, activeBookings: active, cancelledBookings: cancelled, totalRevenue: revenue, totalDeposits: deposits },
      details: bookings,
      charts: { byDay: Object.values(byDay), byCategory: Object.values(byCategory), topServices },
    },
  }
}
