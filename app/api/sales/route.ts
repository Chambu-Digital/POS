import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

async function generateOrderNumber(models: any, ownerId: string): Promise<string> {
  const count = await models.Sale.countDocuments({ userId: ownerId })
  return `ORD-${String(count + 1).padStart(5, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const query: any = { userId: ownerId }
    if (branchContext) {
      query.branchId = branchContext
    }

    const sales = await models.Sale.find(query)
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ sales })
  } catch (error) {
    console.error('[sales] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    // Generate unique order number FIRST (needed for ledger entries)
    const orderNumber = await generateOrderNumber(models, ownerId)

    // ── PAYMENT VALIDATION ────────────────────────────────────────────────────
    const saleTotal = data.total || 0
    let payments = data.payments || []
    
    // Handle legacy single payment format for backward compatibility
    if (!payments.length && data.paymentMethod) {
      payments = [{
        method: data.paymentMethod,
        amount: data.amountPaid || saleTotal,
        mpesaCode: data.mpesaCode || '',
        mpesaPhone: data.mpesaPhone || '',
        timestamp: new Date(),
      }]
    }

    // Validate payments
    if (!payments.length) {
      return NextResponse.json({ error: 'At least one payment method is required' }, { status: 400 })
    }

    const totalPaid = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0)
    
    // Allow overpayment for cash (change scenario), but prevent for other methods
    const hasCashPayment = payments.some((p: any) => p.method === 'cash')
    if (totalPaid > saleTotal && !hasCashPayment) {
      return NextResponse.json({ 
        error: `Payment amount (${totalPaid.toFixed(2)}) exceeds sale total (${saleTotal.toFixed(2)}). Overpayment only allowed for cash payments.` 
      }, { status: 400 })
    }

    // Calculate debt (for non-cash overpayment is already blocked above)
    const debt = Math.max(0, saleTotal - totalPaid)
    let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'paid'
    if (debt > 0) {
      paymentStatus = totalPaid > 0 ? 'partial' : 'unpaid'
      
      // If there's debt but no customer, reject the sale
      if (!data.customerId) {
        return NextResponse.json({ 
          error: 'Customer must be selected for unpaid or partial payments. Please select a customer or pay the full amount.' 
        }, { status: 400 })
      }
    }

    // ── STOCK DEDUCTION & LEDGER ──────────────────────────────────────────────
    for (const item of data.items) {
      if (!item.productId) continue
      try {
        const productObjId = new Types.ObjectId(item.productId)
        const product = await models.Product.findById(productObjId).select('stock').lean() as any
        if (!product) continue
        const previousStock = product.stock ?? 0
        const newStock      = Math.max(0, previousStock - item.quantity)
        await models.Product.findByIdAndUpdate(
          productObjId,
          { $inc: { stock: -item.quantity }, updatedAt: new Date() }
        )
        try {
          await (models as any).StockLedger.create({
            userId:        ownerId,
            productId:     productObjId,
            staffId:       payload.type === 'staff' ? new Types.ObjectId(payload.userId) : null,
            type:          'SALE',
            quantity:      -item.quantity,
            previousStock,
            newStock,
            orderNumber,
            timestamp:     new Date(),
          })
        } catch (ledgerError) {
          console.error('[sales] StockLedger creation failed:', ledgerError)
        }
      } catch (productError) {
        console.error('[sales] Product processing failed:', productError)
      }
    }

    // ── CUSTOMER DEBT HANDLING ────────────────────────────────────────────────
    let customerId = data.customerId || null
    let customerName = data.customerName || ''

    if (customerId && debt > 0) {
      // Auto-record debt for customer
      const customer = await models.Customer.findById(customerId)
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }

      // Add debt to customer balance
      customer.creditBalance = (customer.creditBalance || 0) + debt
      customer.ledger.push({
        date: new Date(),
        type: 'purchase',
        amount: debt,
        balance: customer.creditBalance,
        saleId: null, // Will be updated after sale creation
        note: `Sale ${orderNumber} - Unpaid balance`,
      })
      await customer.save()
      customerName = customer.name
    } else if (customerId) {
      // No debt, but customer is selected (fully paid)
      const customer = await models.Customer.findById(customerId)
      if (customer) {
        customerName = customer.name
      }
    }

    // ── CREATE SALE ───────────────────────────────────────────────────────────
    const sale = new models.Sale({
      userId: ownerId,
      branchId: branchContext || null,
      staffId: payload.type === 'staff' ? payload.userId : null,
      orderNumber,
      customerId: customerId ? new Types.ObjectId(customerId) : null,
      customerName: customerName || data.customerName || '',
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount || 0,
      total: saleTotal,
      
      // New payment structure
      payments: payments.map((p: any) => ({
        method: p.method,
        amount: parseFloat(p.amount),
        bankProviderId: p.bankProviderId || null,
        bankProviderName: p.bankProviderName || '',
        mpesaCode: p.mpesaCode || '',
        mpesaPhone: p.mpesaPhone || '',
        timestamp: p.timestamp || new Date(),
      })),
      debt,
      paymentStatus,
      
      // Legacy fields for backward compatibility
      amountPaid: totalPaid,
      paymentMethod: payments[0]?.method || 'cash',
      mpesaCode: payments.find((p: any) => p.method === 'mobile_money')?.mpesaCode || '',
      mpesaPhone: payments.find((p: any) => p.method === 'mobile_money')?.mpesaPhone || '',
      creditApplied: 0,
      
      notes: data.notes || '',
      source: data.source || 'pos',
      rentalMeta: data.rentalMeta || undefined,
      status: 'completed',
    })
    await sale.save()

    // Update customer ledger with saleId
    if (customerId && debt > 0) {
      await models.Customer.findByIdAndUpdate(
        customerId,
        { $set: { 'ledger.$[elem].saleId': sale._id } },
        { arrayFilters: [{ 'elem.saleId': null, 'elem.note': `Sale ${orderNumber} - Unpaid balance` }] }
      )
    }

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[sales] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create sale' }, { status: 500 })
  }
}
