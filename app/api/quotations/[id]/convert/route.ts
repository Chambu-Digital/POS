import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

// Convert quotation to sale
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const quotation = await models.Quotation.findOne({ _id: params.id, userId: ownerId })
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    // Check if already converted
    if (quotation.status === 'converted') {
      return NextResponse.json(
        { error: 'Quotation has already been converted to a sale' },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date() > quotation.validUntil) {
      return NextResponse.json(
        { error: 'Quotation has expired. Please create a new quotation or extend the validity date.' },
        { status: 400 }
      )
    }

    // Get payment details from request body
    const body = await request.json()
    const { 
      paymentMethod,
      amountPaid,
      mpesaCode,
      mpesaPhone,
      payments,
      notes
    } = body

    // Validation
    if (!paymentMethod && (!payments || payments.length === 0)) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      )
    }

    // Verify stock availability for each product
    const stockIssues = []
    for (const item of quotation.items) {
      const product = await models.Product.findById(item.productId)
      if (!product) {
        stockIssues.push(`${item.productName} is no longer available`)
        continue
      }
      
      if (product.stock < item.quantity) {
        stockIssues.push(`${item.productName}: only ${product.stock} in stock (need ${item.quantity})`)
      }
    }

    if (stockIssues.length > 0) {
      return NextResponse.json(
        { 
          error: 'Stock availability issues',
          details: stockIssues 
        },
        { status: 400 }
      )
    }

    // Generate order number for sale
    const lastSale = await models.Sale
      .findOne({ userId: ownerId })
      .sort({ createdAt: -1 })
      .select('orderNumber')
      .lean()

    let orderNumber = 'ORD-001'
    if (lastSale?.orderNumber) {
      const match = lastSale.orderNumber.match(/ORD-(\d+)/)
      if (match) {
        const nextNum = parseInt(match[1]) + 1
        orderNumber = `ORD-${nextNum.toString().padStart(3, '0')}`
      }
    }

    // Create sale from quotation
    const sale = new models.Sale({
      userId: ownerId,
      branchId: quotation.branchId || payload.branchId || null,
      staffId: payload.type === 'staff' ? payload.userId : null,
      orderNumber,
      customerId: quotation.customerId,
      customerName: quotation.customerName,
      items: quotation.items.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.unitPrice,
        discount: 0,
      })),
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      total: quotation.total,
      amountPaid: amountPaid || quotation.total,
      paymentMethod: paymentMethod || 'cash',
      mpesaCode: mpesaCode || '',
      mpesaPhone: mpesaPhone || '',
      payments: payments || [{
        method: paymentMethod || 'cash',
        amount: amountPaid || quotation.total,
        timestamp: new Date(),
      }],
      debt: Math.max(0, quotation.total - (amountPaid || quotation.total)),
      paymentStatus: (amountPaid || quotation.total) >= quotation.total ? 'paid' : 'partial',
      notes: notes || `Converted from quotation ${quotation.quotationNumber}`,
      status: 'completed',
      createdAt: new Date(),
    })

    await sale.save()

    // Update product stock
    for (const item of quotation.items) {
      await models.Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } }
      )
    }

    // Update quotation status and link to sale
    quotation.status = 'converted'
    quotation.convertedToSaleId = sale._id
    await quotation.save()

    return NextResponse.json({
      success: true,
      sale: {
        ...sale.toObject(),
        _id: sale._id.toString(),
        userId: sale.userId.toString(),
        customerId: sale.customerId?.toString() || null,
        branchId: sale.branchId?.toString() || null,
        staffId: sale.staffId?.toString() || null,
      },
      quotation: {
        ...quotation.toObject(),
        _id: quotation._id.toString(),
        userId: quotation.userId.toString(),
        customerId: quotation.customerId.toString(),
        branchId: quotation.branchId?.toString() || null,
        createdBy: quotation.createdBy?.toString() || null,
        convertedToSaleId: quotation.convertedToSaleId.toString(),
      }
    })
  } catch (error: any) {
    console.error('Convert quotation error:', error)
    return NextResponse.json(
      { error: 'Failed to convert quotation to sale', details: error.message },
      { status: 500 }
    )
  }
}
