import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import Report from '@/lib/models/Report'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const ownerId = decoded.role === 'staff' && decoded.adminId ? decoded.adminId : decoded.userId

    await dbConnect()

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
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const ownerId = decoded.role === 'staff' && decoded.adminId ? decoded.adminId : decoded.userId

    await dbConnect()

    const body = await request.json()
    const { reportType, startDate, endDate } = body

    if (!reportType || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Report type and date range are required' },
        { status: 400 }
      )
    }

    // Generate report based on type
    let reportData: any = {}

    if (reportType === 'sales') {
      reportData = await generateSalesReport(ownerId, new Date(startDate), new Date(endDate))
    } else if (reportType === 'inventory') {
      reportData = await generateInventoryReport(ownerId)
    } else if (reportType === 'profit') {
      reportData = await generateProfitReport(ownerId, new Date(startDate), new Date(endDate))
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

    return NextResponse.json({ report, message: 'Report generated successfully' })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

async function generateSalesReport(userId: string, startDate: Date, endDate: Date) {
  const sales = await Sale.find({
    userId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean()

  const totalSales = sales.length
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const totalDiscount = sales.reduce((sum, sale) => sum + (sale.discount || 0), 0)

  // Group by day
  const salesByDay = sales.reduce((acc: any, sale) => {
    const date = new Date(sale.createdAt).toISOString().split('T')[0]
    if (!acc[date]) {
      acc[date] = { date, sales: 0, revenue: 0 }
    }
    acc[date].sales += 1
    acc[date].revenue += sale.total
    return acc
  }, {})

  return {
    title: 'Sales Report',
    description: `Sales report from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
    data: {
      summary: {
        totalSales,
        totalRevenue,
        totalDiscount,
        averageSaleValue: totalSales > 0 ? totalRevenue / totalSales : 0,
      },
      details: sales,
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
    (sum, p) => sum + p.stock * p.buyingPrice,
    0
  )
  const lowStockItems = products.filter((p) => p.stock < 10).length
  const outOfStockItems = products.filter((p) => p.stock === 0).length

  // Group by category
  const byCategory = products.reduce((acc: any, product) => {
    const cat = product.category || 'Uncategorized'
    if (!acc[cat]) {
      acc[cat] = { category: cat, count: 0, value: 0 }
    }
    acc[cat].count += 1
    acc[cat].value += product.stock * product.buyingPrice
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
  }).lean() as any[]

  let totalRevenue = 0
  let totalCost = 0

  // Calculate profit from sales
  for (const sale of sales) {
    totalRevenue += sale.total
    // Estimate cost based on items (simplified)
    for (const item of sale.items) {
      const product = await Product.findOne({
        userId,
        productName: item.productName,
      }).lean() as any
      if (product) {
        totalCost += product.buyingPrice * item.quantity
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
        profitMargin,
      },
      details: sales,
      charts: {},
    },
  }
}

