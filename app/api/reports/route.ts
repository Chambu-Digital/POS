import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/jwt'
import { connectDB } from '@/lib/db'
import Report from '@/lib/models/Report'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'
import Rental from '@/lib/models/Rental'

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
    } else if (reportType === 'rentals') {
      reportData = await generateRentalsReport(ownerId, new Date(startDate), new Date(endDate))
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
  }).populate('staffId', 'name').lean()

  console.log('[Sales Report] Found sales:', sales.length)

  // If no sales found in date range, get all sales for this user
  let allSales = sales
  if (sales.length === 0) {
    console.log('[Sales Report] No sales in date range, fetching all sales')
    allSales = await Sale.find({ userId }).populate('staffId', 'name').lean()
    console.log('[Sales Report] Total sales for user:', allSales.length)
  }

  const totalSales = allSales.length
  const totalRevenue = allSales.reduce((sum, sale) => sum + sale.total, 0)
  const totalDiscount = allSales.reduce((sum, sale) => sum + (sale.discount || 0), 0)
  const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0

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
      },
      details: allSales.map((s: any) => ({
        ...s,
        servedBy: s.staffId?.name || 'Owner',
      })),
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
    .populate('staffId', 'name')
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

  return {
    title: 'Profit Report',
    description: `Profit analysis from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
    data: {
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
      },
      details: sales.map((s: any) => ({
        ...s,
        servedBy: s.staffId?.name || 'Owner',
      })),
      charts: {},
    },
  }
}


async function generateRentalsReport(userId: string, startDate: Date, endDate: Date) {
  const adjustedStart = new Date(startDate)
  adjustedStart.setHours(0, 0, 0, 0)
  const adjustedEnd = new Date(endDate)
  adjustedEnd.setHours(23, 59, 59, 999)

  const rentals = await Rental.find({
    userId,
    createdAt: { $gte: adjustedStart, $lte: adjustedEnd },
  }).populate('staffId', 'name').lean() as any[]

  const totalRentals = rentals.length
  const activeRentals = rentals.filter(r => r.status === 'active').length
  const returnedRentals = rentals.filter(r => r.status === 'returned').length
  const overdueRentals = rentals.filter(r => r.status === 'overdue').length
  const totalRevenue = rentals.filter(r => r.totalAmount).reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const totalDeposits = rentals.reduce((sum, r) => sum + (r.deposit || 0), 0)
  const avgDuration = returnedRentals > 0
    ? rentals.filter(r => r.duration).reduce((sum, r) => sum + (r.duration || 0), 0) / returnedRentals
    : 0

  // Top rented items
  const itemCounts: Record<string, { name: string; count: number }> = {}
  for (const rental of rentals) {
    for (const item of rental.items) {
      if (!itemCounts[item.productName]) {
        itemCounts[item.productName] = { name: item.productName, count: 0 }
      }
      itemCounts[item.productName].count += item.quantity
    }
  }
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5)

  return {
    title: 'Rentals Report',
    description: `Rental activity from ${adjustedStart.toLocaleDateString()} to ${adjustedEnd.toLocaleDateString()}`,
    data: {
      summary: {
        totalRentals,
        activeRentals,
        returnedRentals,
        overdueRentals,
        totalRevenue,
        totalDeposits,
        avgDurationMinutes: Math.round(avgDuration),
      },
      details: rentals.map((r: any) => ({
        ...r,
        servedBy: r.staffId?.name || 'Owner',
      })),
      charts: { topItems },
    },
  }
}
