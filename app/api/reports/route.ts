import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Report from '@/lib/models/Report';
import Sale from '@/lib/models/Sale';
import Product from '@/lib/models/Product';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Missing required parameters: type, startDate, endDate' 
      }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    let reportData;

    switch (type) {
      case 'sales':
        reportData = await generateSalesReport(user.userId, start, end);
        break;
      case 'inventory':
        reportData = await generateInventoryReport(user.userId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    // Save the report
    const report = new Report({
      userId: user.userId,
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      data: reportData,
      dateRange: { start, end }
    });

    await report.save();

    return NextResponse.json({
      success: true,
      report: {
        id: report._id,
        type: report.type,
        title: report.title,
        data: report.data,
        dateRange: report.dateRange,
        generatedAt: report.generatedAt
      }
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate report' 
    }, { status: 500 });
  }
}

async function generateSalesReport(userId: string, startDate: Date, endDate: Date) {
  const sales = await Sale.find({
    userId,
    createdAt: { $gte: startDate, $lte: endDate }
  }).populate('items.productId');

  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  const topProducts = await Sale.aggregate([
    { $match: { userId, createdAt: { $gte: startDate, $lte: endDate } } },
    { $unwind: '$items' },
    { $group: {
      _id: '$items.productId',
      totalQuantity: { $sum: '$items.quantity' },
      totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
    }},
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 }
  ]);

  return {
    summary: {
      totalSales,
      totalRevenue,
      averageOrderValue
    },
    topProducts,
    salesByDay: await getSalesByDay(userId, startDate, endDate)
  };
}

async function generateInventoryReport(userId: string) {
  const products = await Product.find({ userId });
  
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const outOfStockProducts = products.filter(p => p.stock === 0);
  const totalValue = products.reduce((sum, product) => sum + (product.price * product.stock), 0);

  return {
    summary: {
      totalProducts,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      totalValue
    },
    lowStockProducts: lowStockProducts.map(p => ({
      id: p._id,
      name: p.name,
      stock: p.stock,
      minStock: p.minStock
    })),
    outOfStockProducts: outOfStockProducts.map(p => ({
      id: p._id,
      name: p.name,
      price: p.price
    }))
  };
}

async function getSalesByDay(userId: string, startDate: Date, endDate: Date) {
  return await Sale.aggregate([
    { $match: { userId, createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      totalSales: { $sum: 1 },
      totalRevenue: { $sum: "$total" }
    }},
    { $sort: { _id: 1 } }
  ]);
}