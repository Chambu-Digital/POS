import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

async function generateOrderNumber(models: any, ownerId: string): Promise<string> {
  const count = await models.Sale.countDocuments({ userId: ownerId })
  return `RX-${String(count + 1).padStart(5, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // ── FEFO batch deduction ──────────────────────────────────────────────────
    for (const item of data.items) {
      if (!item.productId) continue

      let remaining = item.quantity

      // Get active batches for this drug sorted by expiry (FEFO)
      const batches = await models.DrugBatch.find({
        userId: ownerId,
        drugId: new Types.ObjectId(item.productId),
        status: 'active',
        quantity: { $gt: 0 },
      }).sort({ expiryDate: 1 })

      for (const batch of batches) {
        if (remaining <= 0) break
        const deduct = Math.min(batch.quantity, remaining)
        batch.quantity -= deduct
        if (batch.quantity === 0) batch.status = 'depleted'
        await batch.save()
        remaining -= deduct
      }

      // Update Drug stock total
      await models.Drug.findByIdAndUpdate(
        new Types.ObjectId(item.productId),
        { $inc: { stock: -item.quantity } }
      )
    }

    // ── Generate order number ─────────────────────────────────────────────────
    const orderNumber = await generateOrderNumber(models, ownerId)

    // ── Handle credit payment ─────────────────────────────────────────────────
    let customerId = data.customerId || null
    let customerName = data.customerName || ''
    let creditApplied = 0

    if (data.paymentMethod === 'credit' && customerId) {
      const customer = await models.Customer.findById(customerId)
      if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

      const amountPaid = data.amountPaid || 0
      const newDebt = data.total - amountPaid
      let debtChange = newDebt

      if (amountPaid > data.total) {
        const excess = amountPaid - data.total
        debtChange = -Math.min(excess, customer.creditBalance)
      }

      customer.creditBalance = Math.max(0, customer.creditBalance + debtChange)
      customer.ledger.push({
        date: new Date(), type: 'purchase',
        amount: debtChange, balance: customer.creditBalance,
        note: `Pharmacy sale ${orderNumber}`,
      })
      await customer.save()
      creditApplied = amountPaid
      customerName = customer.name
    } else if (customerId) {
      const customer = await models.Customer.findById(customerId)
      if (customer) {
        const amountPaid = data.amountPaid || data.total
        if (amountPaid > data.total && customer.creditBalance > 0) {
          const excess = amountPaid - data.total
          const reduction = Math.min(excess, customer.creditBalance)
          customer.creditBalance -= reduction
          customer.ledger.push({ date: new Date(), type: 'payment', amount: -reduction, balance: customer.creditBalance, note: `Overpayment on ${orderNumber}` })
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
      source: 'pos',
    })
    await sale.save()

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[pharmacy/sale POST]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process sale' }, { status: 500 })
  }
}
