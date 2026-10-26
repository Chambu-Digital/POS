import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { normalisePermissions } from '@/lib/modules'
import { Types } from 'mongoose'

// ── helper: cap a payment amount at its actual revenue share (strips cash change) ──
function cappedPaymentAmount(payment: any, allPayments: any[], saleTotal: number): number {
  const methodName = payment.customMethodName || payment.method || 'cash'
  const otherTotal = allPayments
    .filter((op: any) => {
      const opName = op.customMethodName || op.method || 'cash'
      return opName !== methodName && opName.toLowerCase() !== 'credit'
    })
    .reduce((s: number, op: any) => s + (op.amount || 0), 0)
  return Math.min(payment.amount || 0, Math.max(0, saleTotal - otherTotal))
}

// ── helper: compute byPayment from a list of sales ────────────────────────────
function computeByPayment(sales: any[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const s of sales) {
    if (s.payments && Array.isArray(s.payments) && s.payments.length > 0) {
      for (const p of s.payments) {
        const name = p.customMethodName || p.method || 'cash'
        if (name.toLowerCase() === 'credit') continue
        acc[name] = (acc[name] || 0) + cappedPaymentAmount(p, s.payments, s.total)
      }
    } else {
      const m = s.paymentMethod || 'cash'
      if (m.toLowerCase() === 'credit') continue
      acc[m] = (acc[m] || 0) + s.total
    }
  }
  return acc
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const isStaff = payload.type === 'staff'
    const ownerId = isStaff && payload.adminId ? payload.adminId : payload.userId
    const ownerObjId = new Types.ObjectId(ownerId)
    const perms = isStaff ? normalisePermissions(payload.permissions || {}) : null

    const branchContext = await getBranchContext(request)
    const branchObjId = branchContext ? new Types.ObjectId(branchContext) : null

    const canSeeReports   = !isStaff || perms?.['pos.reports'] === true
    const canSeeInventory = !isStaff || perms?.['pos.inventory'] === true

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    const periodStart = new Date(now); periodStart.setDate(now.getDate() - days)
    const last7Start  = new Date(now); last7Start.setDate(now.getDate() - 7)

    const tenantId = payload.mongoUri || payload.userId

    // ── Base match filters ────────────────────────────────────────────────────
    const baseSaleMatch: any = { userId: ownerObjId }
    if (branchObjId) baseSaleMatch.branchId = branchObjId
    if (isStaff) baseSaleMatch.staffId = new Types.ObjectId(payload.userId)

    const todaySaleMatch = { ...baseSaleMatch, createdAt: { $gte: todayStart, $lte: todayEnd } }
    const periodSaleMatch = { ...baseSaleMatch, createdAt: { $gte: periodStart } }
    const last7SaleMatch  = { ...baseSaleMatch, createdAt: { $gte: last7Start } }

    // ── Date ranges for stock financials ─────────────────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // ── Parallelise all independent DB calls ──────────────────────────────────
    const [
      todaySales,
      todayHospitalitySales,
      todayCustomers,
      // owner-only below
      periodSalesRaw,
      allTimeSalesAgg,
      allTimeHospAgg,
      periodHospSales,
      last7HospSales,
      products,
      staffCount,
      customers,
      rentalAgg,
      todayKitchenOrders,
      recentKitchenOrders,
      recentRetailOrders,
      recentHospOrders,
      inventories,
    ] = await Promise.all([
      // Today's retail sales (light — only fields needed)
      models.Sale.find(todaySaleMatch)
        .select('total discount debt source payments paymentMethod createdAt')
        .lean(),

      // Today's hospitality
      models.HospitalityOrder ? models.HospitalityOrder.find({
        tenantId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
        status: 'completed',
        ...(isStaff ? { servedBy: payload.userId } : {}),
      }).select('total discount payments paymentMethod createdAt').lean() : Promise.resolve([]),

    // Today's credit payments from customer ledger
      models.Customer.find({
        userId: ownerObjId,
        'ledger.date': { $gte: todayStart, $lte: todayEnd },
        'ledger.type': 'payment',
      }).select('name ledger').lean(),

      // Period sales (for charts + payment methods) — populate only for top products
      canSeeReports ? models.Sale.find(periodSaleMatch)
        .select('total discount debt source payments paymentMethod items costOfGoodsSold createdAt')
        .populate('items.productId', 'productName')
        .lean() : Promise.resolve([]),

      // All-time aggregate: count + sum via $group — NO full document fetch
      canSeeReports ? models.Sale.aggregate([
        { $match: branchObjId ? { userId: ownerObjId, branchId: branchObjId } : { userId: ownerObjId } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' }, discount: { $sum: { $ifNull: ['$discount', 0] } } } },
      ]) : Promise.resolve([]),

      // All-time hospitality aggregate
      canSeeReports && models.HospitalityOrder ? models.HospitalityOrder.aggregate([
        { $match: { tenantId, status: 'completed' } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' } } },
      ]) : Promise.resolve([]),

      // Period hospitality sales
      canSeeReports && models.HospitalityOrder ? models.HospitalityOrder.find({
        tenantId, status: 'completed', createdAt: { $gte: periodStart },
      }).select('total discount debt payments paymentMethod items createdAt').lean() : Promise.resolve([]),

      // Last-7-days hospitality (for chart)
      canSeeReports && models.HospitalityOrder ? models.HospitalityOrder.find({
        tenantId, status: 'completed', createdAt: { $gte: last7Start },
      }).select('total createdAt').lean() : Promise.resolve([]),

      // Products (needed for stock stats — only if owner)
      canSeeReports ? models.Product.find({ userId: ownerObjId })
        .select('sellingPrice buyingPrice stock lowStockThreshold')
        .lean() : Promise.resolve([]),

      // Staff count
      branchObjId
        ? models.Staff.countDocuments({ userId: ownerObjId, branchId: branchObjId, active: true })
        : models.Staff.countDocuments({ userId: ownerObjId, active: true }),

      // Credit payments for period
      canSeeReports ? models.Customer.find({
        userId: ownerObjId,
        'ledger.date': { $gte: periodStart },
        'ledger.type': 'payment',
      }).select('ledger').lean() : Promise.resolve([]),

      // Rental aggregate — count + revenue, no full fetch
      canSeeReports ? models.RentalBooking.aggregate([
        { $match: branchObjId ? { userId: ownerObjId, branchId: branchObjId } : { userId: ownerObjId } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
        }},
      ]) : Promise.resolve([]),

      // Today's kitchen orders
      models.KitchenOrder.find({
        userId: ownerObjId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
        ...(branchObjId ? { branchId: branchObjId } : {}),
      }).select('status tableNumber waiterName orderNumber createdAt preparingAt readyAt').lean(),

      // Recent kitchen orders (last 5)
      models.KitchenOrder.find({
        userId: ownerObjId,
        ...(branchObjId ? { branchId: branchObjId } : {}),
      }).sort({ createdAt: -1 }).limit(5)
        .select('status tableNumber waiterName orderNumber createdAt').lean(),

      // Recent retail orders (last 10)
      models.Sale.find({ userId: ownerObjId, ...(branchObjId ? { branchId: branchObjId } : {}) })
        .sort({ createdAt: -1 }).limit(10)
        .select('total createdAt source orderNumber staffId')
        .populate('staffId', 'name firstName lastName').lean(),

      // Recent hospitality orders (last 10)
      models.HospitalityOrder ? models.HospitalityOrder.find({ tenantId, status: 'completed' })
        .sort({ createdAt: -1 }).limit(10)
        .select('total createdAt orderNumber').lean() : Promise.resolve([]),

      // Branch inventories (only if branch context)
      canSeeReports && branchObjId ? models.ProductInventory.find({
        userId: ownerObjId, branchId: branchObjId,
      }).select('productId stock').lean() : Promise.resolve([]),
    ])

    // ── Stock financial data (owner view only, non-blocking) ─────────────────
    let stockFinancials = {
      investedThisMonth: 0,    // cash spent on stock this month (paid receipts)
      totalOwedToSuppliers: 0, // all unpaid receipts
      totalAdvancesOut: 0,     // all prepaid receipts awaiting goods
      netSupplierPosition: 0,  // owed - advances (positive = you owe more than outstanding advances)
    }
    if (canSeeReports && !isStaff) {
      const stockMatch = branchObjId ? { userId: ownerObjId, branchId: branchObjId } : { userId: ownerObjId }
      const [monthlyPaid, allUnpaid, allPrepaid] = await Promise.all([
        (models as any).StockReceipt.aggregate([
          { $match: { ...stockMatch, paymentStatus: 'paid', paidAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: '$totalCost' } } }
        ]),
        (models as any).StockReceipt.aggregate([
          { $match: { ...stockMatch, paymentStatus: 'unpaid' } },
          { $group: { _id: null, total: { $sum: '$totalCost' } } }
        ]),
        (models as any).StockReceipt.aggregate([
          { $match: { ...stockMatch, paymentStatus: 'prepaid' } },
          { $group: { _id: null, total: { $sum: '$totalCost' } } }
        ]),
      ])
      const invested = monthlyPaid[0]?.total || 0
      const owed     = allUnpaid[0]?.total   || 0
      const advances = allPrepaid[0]?.total  || 0
      stockFinancials = {
        investedThisMonth:    invested,
        totalOwedToSuppliers: owed,
        totalAdvancesOut:     advances,
        netSupplierPosition:  owed - advances,
      }
    }

    // ── Today's credit collected ──────────────────────────────────────────────
    let creditCollected = 0
    for (const customer of todayCustomers as any[]) {
      for (const entry of customer.ledger) {
        const d = new Date(entry.date)
        if (d >= todayStart && d <= todayEnd && entry.type === 'payment' && entry.amount < 0) {
          // Staff only see credit they personally collected
          if (isStaff && entry.collectedBy?.toString() !== payload.userId) continue
          creditCollected += Math.abs(entry.amount)
        }
      }
    }

    // ── Today stats ───────────────────────────────────────────────────────────
    const todayAll = [...(todaySales as any[]), ...(todayHospitalitySales as any[])]
    const salesRevenue = todayAll.reduce((s: number, x: any) => s + x.total, 0)

    const todayStats = {
      totalOrders: todayAll.length,
      totalRevenue: salesRevenue + creditCollected,
      bySource: {
        pos:         (todaySales as any[]).filter((s: any) => !s.source || s.source === 'pos').reduce((s: number, x: any) => s + x.total, 0),
        kds:         (todaySales as any[]).filter((s: any) => s.source === 'kds').reduce((s: number, x: any) => s + x.total, 0),
        rental:      (todaySales as any[]).filter((s: any) => s.source === 'rental').reduce((s: number, x: any) => s + x.total, 0),
        hospitality: (todayHospitalitySales as any[]).reduce((s: number, x: any) => s + x.total, 0),
      },
      byPayment: computeByPayment(todayAll),
      creditIssued:    (todaySales as any[]).reduce((s: number, x: any) => s + (x.debt || 0), 0),
      creditCollected,
    }

    // ── Staff-only minimal response ───────────────────────────────────────────
    if (isStaff && !canSeeReports) {
      const [staffRecentOrders, staffRecentHosp] = await Promise.all([
        models.Sale.find({ userId: ownerObjId, staffId: new Types.ObjectId(payload.userId), ...(branchObjId ? { branchId: branchObjId } : {}) })
          .sort({ createdAt: -1 }).limit(10).select('total createdAt source').lean(),
        models.HospitalityOrder ? models.HospitalityOrder.find({ tenantId, servedBy: payload.userId })
          .sort({ createdAt: -1 }).limit(10).select('total createdAt orderNumber').lean() : Promise.resolve([]),
      ])

      const combinedOrders = [
        ...(staffRecentOrders as any[]).map((o: any) => ({ ...o, source: 'retail', orderNum: o._id.toString().slice(-6).toUpperCase() })),
        ...(staffRecentHosp as any[]).map((o: any) => ({ ...o, source: 'hospitality', orderNum: o.orderNumber })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)

      let staffProducts = null
      if (canSeeInventory) {
        const [total, lowStockItems] = await Promise.all([
          branchObjId
            ? models.ProductInventory.countDocuments({ userId: ownerObjId, branchId: branchObjId })
            : models.Product.countDocuments({ userId: ownerObjId }),
          branchObjId
            ? models.ProductInventory.countDocuments({ userId: ownerObjId, branchId: branchObjId, stock: { $lt: 10 } })
            : models.Product.countDocuments({ userId: ownerObjId, $expr: { $lt: ['$stock', { $ifNull: ['$lowStockThreshold', 10] }] } }),
        ])
        staffProducts = { total, lowStockItems, stockValue: 0, totalStock: 0, outOfStockItems: 0 }
      }

      return NextResponse.json({ stats: { isStaffView: true, todayStats, recentOrders: combinedOrders, products: staffProducts } })
    }

    // ── All-time totals from aggregation (no full fetch) ──────────────────────
    const retailAgg = (allTimeSalesAgg as any[])[0] || { count: 0, revenue: 0, discount: 0 }
    const hospAgg   = (allTimeHospAgg as any[])[0]  || { count: 0, revenue: 0 }
    const totalSales   = retailAgg.count + hospAgg.count
    const totalRevenue = retailAgg.revenue + hospAgg.revenue
    const totalDiscount = retailAgg.discount
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0

    // ── Period revenue by source ──────────────────────────────────────────────
    const revenueBySource = {
      pos:         (periodSalesRaw as any[]).filter((s: any) => !s.source || s.source === 'pos').reduce((s: number, x: any) => s + x.total, 0),
      kds:         (periodSalesRaw as any[]).filter((s: any) => s.source === 'kds').reduce((s: number, x: any) => s + x.total, 0),
      rental:      (periodSalesRaw as any[]).filter((s: any) => s.source === 'rental').reduce((s: number, x: any) => s + x.total, 0),
      hospitality: (periodHospSales as any[]).reduce((s: number, x: any) => s + x.total, 0),
    }

    // ── Product stats ─────────────────────────────────────────────────────────
    let productStats: any
    if (branchObjId && (inventories as any[]).length > 0) {
      const productMap = new Map((products as any[]).map((p: any) => [p._id.toString(), p]))
      let totalStock = 0, stockValue = 0, stockValueAtCost = 0, lowStockCount = 0, outOfStockCount = 0
      for (const inv of inventories as any[]) {
        const p = productMap.get(inv.productId?.toString())
        if (p) {
          totalStock += inv.stock || 0
          stockValue += (inv.stock || 0) * (p.sellingPrice || 0)
          stockValueAtCost += (inv.stock || 0) * (p.buyingPrice || 0)
          if ((inv.stock || 0) < (p.lowStockThreshold || 10)) lowStockCount++
          if ((inv.stock || 0) === 0) outOfStockCount++
        }
      }
      productStats = { total: (inventories as any[]).length, totalStock, stockValue, stockValueAtCost, estimatedProfit: stockValue - stockValueAtCost, lowStockItems: lowStockCount, outOfStockItems: outOfStockCount }
    } else {
      productStats = {
        total: (products as any[]).length,
        totalStock: (products as any[]).reduce((s: number, p: any) => s + p.stock, 0),
        stockValue: (products as any[]).reduce((s: number, p: any) => s + (p.stock * p.sellingPrice), 0),
        stockValueAtCost: (products as any[]).reduce((s: number, p: any) => s + (p.stock * (p.buyingPrice || 0)), 0),
        estimatedProfit: (products as any[]).reduce((s: number, p: any) => s + (p.stock * ((p.sellingPrice || 0) - (p.buyingPrice || 0))), 0),
        lowStockItems: (products as any[]).filter((p: any) => p.stock < (p.lowStockThreshold || 10)).length,
        outOfStockItems: (products as any[]).filter((p: any) => p.stock === 0).length,
      }
    }

    // ── Sales by day chart (last 7 days) ──────────────────────────────────────
    const salesByDay: Record<string, { date: string; sales: number; revenue: number }> = {}
    // Retail last-7: filter from periodSalesRaw (avoid extra query if days >= 7)
    const last7SalesRetail = days >= 7
      ? (periodSalesRaw as any[]).filter((s: any) => new Date(s.createdAt) >= last7Start)
      : await models.Sale.find(last7SaleMatch).select('total createdAt').lean()

    for (const sale of [...last7SalesRetail, ...(last7HospSales as any[])]) {
      const date = new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!salesByDay[date]) salesByDay[date] = { date, sales: 0, revenue: 0 }
      salesByDay[date].sales += 1
      salesByDay[date].revenue += sale.total
    }

    // ── Top products ──────────────────────────────────────────────────────────
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {}
    for (const sale of periodSalesRaw as any[]) {
      for (const item of sale.items || []) {
        const name = item.productId?.productName || 'Unknown'
        if (!productSales[name]) productSales[name] = { name, quantity: 0, revenue: 0 }
        productSales[name].quantity += item.quantity
        productSales[name].revenue += item.price * item.quantity
      }
    }
    for (const sale of periodHospSales as any[]) {
      for (const item of sale.items || []) {
        const name = item.name || 'Unknown'
        if (!productSales[name]) productSales[name] = { name, quantity: 0, revenue: 0 }
        productSales[name].quantity += item.quantity
        productSales[name].revenue += item.totalPrice
      }
    }

    // ── Payment methods + credit for period ───────────────────────────────────
    const paymentMethods: Record<string, { method: string; count: number; total: number }> = {}
    let creditIssued = 0
    for (const sale of [...(periodSalesRaw as any[]), ...(periodHospSales as any[])]) {
      if (sale.debt && sale.debt > 0) creditIssued += sale.debt
      const byPayment = computeByPayment([sale])
      for (const [method, amount] of Object.entries(byPayment)) {
        if (!paymentMethods[method]) paymentMethods[method] = { method, count: 0, total: 0 }
        paymentMethods[method].count += 1
        paymentMethods[method].total += amount as number
      }
    }

    let periodCreditCollected = 0
    for (const customer of customers as any[]) {
      for (const entry of customer.ledger) {
        if (new Date(entry.date) >= periodStart && entry.type === 'payment' && entry.amount < 0) {
          // Staff only see credit they personally collected
          if (isStaff && entry.collectedBy?.toString() !== payload.userId) continue
          periodCreditCollected += Math.abs(entry.amount)
        }
      }
    }

    // ── COGS + gross profit for period (retail sales only — hosp has no COGS) ─
    const periodCOGS = (periodSalesRaw as any[]).reduce(
      (sum: number, s: any) => sum + (s.costOfGoodsSold || 0), 0
    )
    const periodRevenue = (periodSalesRaw as any[]).reduce((s: number, x: any) => s + x.total, 0)
      + (periodHospSales as any[]).reduce((s: number, x: any) => s + x.total, 0)
    const grossProfit   = periodRevenue - periodCOGS
    const grossMarginPct = periodRevenue > 0
      ? Math.round((grossProfit / periodRevenue) * 100)
      : 0

    // ── Recent orders ─────────────────────────────────────────────────────────
    const recentOrders = [
      ...(recentRetailOrders as any[]).map((o: any) => ({ ...o, source: 'retail', orderNum: o._id.toString().slice(-6).toUpperCase() })),
      ...(recentHospOrders as any[]).map((o: any) => ({ ...o, source: 'hospitality', orderNum: o.orderNumber })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)

    // ── Rental stats from aggregation ─────────────────────────────────────────
    const rentalByStatus = Object.fromEntries((rentalAgg as any[]).map((r: any) => [r._id, r]))
    const rentalStats = {
      totalBookings: (rentalAgg as any[]).reduce((s: number, r: any) => s + r.count, 0),
      activeRentals: ((rentalByStatus['active']?.count || 0) + (rentalByStatus['overdue']?.count || 0)),
      completedRentals: rentalByStatus['completed']?.count || 0,
      rentalRevenue: (rentalAgg as any[]).reduce((s: number, r: any) => s + r.revenue, 0),
    }

    // ── KDS stats ─────────────────────────────────────────────────────────────
    const completedKds = (todayKitchenOrders as any[]).filter((o: any) => o.status === 'collected')
    const prepTimes = completedKds
      .filter((o: any) => o.preparingAt && o.readyAt)
      .map((o: any) => (new Date(o.readyAt).getTime() - new Date(o.preparingAt).getTime()) / 60000)

    return NextResponse.json({
      stats: {
        isStaffView: false,
        totalSales, totalRevenue, totalDiscount, averageSaleValue, revenueBySource,
        creditIssued,
        creditCollected: periodCreditCollected,
        recentPeriod: {
          days,
          totalSales: (periodSalesRaw as any[]).length + (periodHospSales as any[]).length,
          revenue: periodRevenue,
          discount: (periodSalesRaw as any[]).reduce((s: number, x: any) => s + (x.discount || 0), 0) + (periodHospSales as any[]).reduce((s: number, x: any) => s + (x.discount || 0), 0),
          costOfGoodsSold: periodCOGS,
          grossProfit,
          grossMarginPct,
        },
        products: productStats,
        staffCount,
        charts: {
          salesByDay: Object.values(salesByDay),
          topProducts: Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
          paymentMethods: Object.values(paymentMethods),
        },
        recentOrders,
        todayStats,
        rentalStats,
        stockFinancials,
        kdsStats: {
          todayTotal: (todayKitchenOrders as any[]).length,
          todayCompleted: completedKds.length,
          todayActive: (todayKitchenOrders as any[]).filter((o: any) => o.status !== 'collected').length,
          tablesServed: new Set((todayKitchenOrders as any[]).map((o: any) => o.tableNumber)).size,
          avgPrepMins: prepTimes.length ? Math.round(prepTimes.reduce((a: number, b: number) => a + b, 0) / prepTimes.length) : 0,
          recentKitchenOrders: (recentKitchenOrders as any[]).map((o: any) => ({ ...o, id: o._id.toString() })),
        },
      },
    })
  } catch (error) {
    console.error('[Dashboard Stats] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard statistics' }, { status: 500 })
  }
}
