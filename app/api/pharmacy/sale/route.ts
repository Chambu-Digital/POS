import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { createInventoryTransaction } from '@/lib/inventory-service'

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

    // Get or determine branchId
    let branchId = data.branchId
    if (!branchId) {
      // Get default branch for this user
      const defaultBranch = await models.Branch.findOne({ userId: ownerId, isDefault: true })
      if (defaultBranch) {
        branchId = defaultBranch._id.toString()
      } else {
        // If no branches exist yet, create a default one
        const newBranch = new models.Branch({
          userId: ownerId,
          name: 'Main Branch',
          code: 'MAIN',
          isDefault: true,
        })
        await newBranch.save()
        branchId = newBranch._id.toString()
      }
    }

    // ── FEFO batch deduction with inventory transactions ─────────────────────────
    for (const item of data.items) {
      if (!item.productId) continue

      let remaining = item.quantity

      // Get active batches for this drug sorted by expiry (FEFO)
      const batches = await models.DrugBatch.find({
        userId: ownerId,
        branchId: new Types.ObjectId(branchId),
        drugId: new Types.ObjectId(item.productId),
        status: 'active',
        quantity: { $gt: 0 },
      }).sort({ expiryDate: 1 })

      for (const batch of batches) {
        if (remaining <= 0) break
        const deduct = Math.min(batch.quantity, remaining)
        
        // Create inventory transaction for this batch deduction
        await createInventoryTransaction(models, {
          userId: ownerId,
          branchId: branchId,
          drugId: item.productId,
          batchId: batch._id.toString(),
          type: 'SALE',
          quantity: deduct,
          referenceId: '', // Will be set after sale is saved
          referenceType: 'sale',
          userIdPerformed: payload.type === 'staff' ? payload.userId : undefined,
          reason: 'Pharmacy sale',
        })

        batch.quantity -= deduct
        if (batch.quantity === 0) batch.status = 'depleted'
        await batch.save()
        remaining -= deduct
      }
    }

    // ── Generate order number ─────────────────────────────────────────────────
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
        note: `Pharmacy sale ${orderNumber} - Unpaid balance`,
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

    const sale = new models.Sale({
      userId: ownerId,
      branchId: new Types.ObjectId(branchId),
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
      source: 'pos',
      status: 'completed',
    })
    await sale.save()

    // Update customer ledger with saleId
    if (customerId && debt > 0) {
      await models.Customer.findByIdAndUpdate(
        customerId,
        { $set: { 'ledger.$[elem].saleId': sale._id } },
        { arrayFilters: [{ 'elem.saleId': null, 'elem.note': `Pharmacy sale ${orderNumber} - Unpaid balance` }] }
      )
    }

    // Update inventory transactions with the sale reference
    await models.InventoryTransaction.updateMany(
      {
        userId: ownerId,
        branchId: new Types.ObjectId(branchId),
        referenceType: 'sale',
        referenceId: '',
      },
      { referenceId: sale._id.toString() }
    )

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[pharmacy/sale POST]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process sale' }, { status: 500 })
  }
}
