import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
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

    const sales = await models.Sale.find({ userId: ownerId })
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

    // Generate unique order number FIRST (needed for ledger entries)
    const orderNumber = await generateOrderNumber(models, ownerId)

    // ── Deduct stock and record ledger entry for each item ───────────────────
    for (const item of data.items) {
      if (!item.productId) continue
      try {
        const productObjId = new Types.ObjectId(item.productId)
        // Read current stock before deducting so we can record previousStock
        const product = await models.Product.findById(productObjId).select('stock').lean() as any
        if (!product) continue
        const previousStock = product.stock ?? 0
        const newStock      = Math.max(0, previousStock - item.quantity)
        // Atomic deduction
        await models.Product.findByIdAndUpdate(
          productObjId,
          { $inc: { stock: -item.quantity }, updatedAt: new Date() }
        )
        // Immutable ledger entry — never fails the sale if writing fails
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
          // Log but don't fail the sale
          console.error('[sales] StockLedger creation failed:', ledgerError)
        }
      } catch (productError) {
        // Log but continue with other products
        console.error('[sales] Product processing failed:', productError)
      }
    }

    // Handle credit payment
    let customerId = data.customerId || null
    let customerName = data.customerName || ''
    let creditApplied = 0

    if (data.paymentMethod === 'credit' && customerId) {
      const customer = await models.Customer.findById(customerId)
      if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

      const saleTotal = data.total
      const amountPaid = data.amountPaid || 0
      const newDebt = saleTotal - amountPaid

      // Smart offset: if paid more than purchase, apply excess to existing debt
      let debtChange = newDebt
      if (amountPaid > saleTotal) {
        const excess = amountPaid - saleTotal
        debtChange = -Math.min(excess, customer.creditBalance)
      }

      customer.creditBalance = Math.max(0, customer.creditBalance + debtChange)
      customer.ledger.push({
        date: new Date(),
        type: 'purchase',
        amount: debtChange,
        balance: customer.creditBalance,
        note: `Sale ${orderNumber}`,
      })
      await customer.save()
      creditApplied = amountPaid
      customerName = customer.name
    } else if (data.paymentMethod !== 'credit' && customerId) {
      // Cash/card sale with identified customer — check if they have existing debt
      const customer = await models.Customer.findById(customerId)
      if (customer) {
        const amountPaid = data.amountPaid || data.total
        if (amountPaid > data.total && customer.creditBalance > 0) {
          // Apply excess to existing debt
          const excess = amountPaid - data.total
          const debtReduction = Math.min(excess, customer.creditBalance)
          customer.creditBalance -= debtReduction
          customer.ledger.push({
            date: new Date(),
            type: 'payment',
            amount: -debtReduction,
            balance: customer.creditBalance,
            note: `Overpayment on ${orderNumber}`,
          })
          await customer.save()
        }
        customerName = customer.name
      }
    }

    const sale = new models.Sale({
      ...data,
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
      orderNumber,
      customerId: customerId ? new Types.ObjectId(customerId) : null,
      customerName: customerName || data.customerName || '',
      creditApplied,
    })
    await sale.save()

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[sales] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create sale' }, { status: 500 })
  }
}
