import demoData from '@/data/demo.json'

export const DEMO_EMAIL = 'demo@chambudigital.co.ke'
export const DEMO_PASSWORD = 'demoxyz'
export const DEMO_USER_ID = 'demo000000000000000000001'

export function isDemoId(userId: string) {
  return userId === DEMO_USER_ID
}

// Fake ObjectId-like string for new demo records
export function demoId() {
  return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function getDemoUser() {
  return demoData.user
}

export function getDemoSettings() {
  return demoData.settings
}

export function getDemoProducts() {
  return demoData.products
}

export function getDemoCategories() {
  return demoData.categories
}

export function getDemoSales() {
  return demoData.sales
}

export function getDemoRentals() {
  return demoData.rentals
}

export function getDemoStaff() {
  return demoData.staff
}

export function getDemoDashboardStats() {
  const sales = demoData.sales
  const products = demoData.products
  const rentals = demoData.rentals

  const totalRevenue = sales.reduce((s, x) => s + x.total, 0)
  const totalSales = sales.length

  const salesByDay = sales.reduce((acc: any, sale) => {
    const date = new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!acc[date]) acc[date] = { date, sales: 0, revenue: 0 }
    acc[date].sales += 1
    acc[date].revenue += sale.total
    return acc
  }, {})

  const productSales: any = {}
  sales.forEach(sale => {
    sale.items.forEach((item: any) => {
      if (!productSales[item.productName]) productSales[item.productName] = { name: item.productName, quantity: 0, revenue: 0 }
      productSales[item.productName].quantity += item.quantity
      productSales[item.productName].revenue += item.price * item.quantity
    })
  })

  const paymentMethods: any = {}
  sales.forEach(sale => {
    const m = sale.paymentMethod
    if (!paymentMethods[m]) paymentMethods[m] = { method: m, count: 0, total: 0 }
    paymentMethods[m].count += 1
    paymentMethods[m].total += sale.total
  })

  return {
    totalSales,
    totalRevenue,
    totalDiscount: sales.reduce((s, x) => s + x.discount, 0),
    averageSaleValue: totalSales > 0 ? totalRevenue / totalSales : 0,
    recentPeriod: { days: 30, totalSales, revenue: totalRevenue, discount: 0 },
    products: {
      total: products.length,
      totalStock: products.reduce((s, p) => s + p.stock, 0),
      stockValue: products.reduce((s, p) => s + p.stock * p.sellingPrice, 0),
      lowStockItems: products.filter(p => p.stock > 0 && p.stock < p.lowStockThreshold).length,
      outOfStockItems: products.filter(p => p.stock === 0).length,
    },
    staffCount: demoData.staff.length,
    charts: {
      salesByDay: Object.values(salesByDay),
      topProducts: Object.values(productSales).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5),
      paymentMethods: Object.values(paymentMethods),
    },
    recentOrders: sales.slice(-10).reverse(),
  }
}
