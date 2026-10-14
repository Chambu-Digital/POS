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

    const { models, conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const query: any = { userId: ownerId }
    if (branchContext) {
      query.branchId = branchContext
    }

    const sales = await models.Sale.find(query)
      .sort({ createdAt: -1 })
      .lean()

    // Fetch owner info for sales without staffId
    const owner = await conn.db.collection('users').findOne({ _id: new Types.ObjectId(ownerId) }) as any
    const ownerName = owner?.firstName && owner?.lastName
      ? `${owner.firstName} ${owner.lastName}`.trim()
      : owner?.shopName || owner?.name || owner?.email || 'Owner'

    const ownerInfo = {
      _id: owner?._id,
      name: ownerName,
      firstName: owner?.firstName,
      lastName: owner?.lastName,
      email: owner?.email,
      isOwner: true,
    }

    // Manually populate staffId for each sale with proper name handling
    const staffIds = [...new Set(sales.map((s: any) => s.staffId).filter(Boolean))]
    const staffMap = new Map()

    if (staffIds.length > 0) {
      const staff = await conn.db.collection('staff')
        .find({ _id: { $in: staffIds } })
        .toArray()

      staff.forEach((s: any) => {
        const name = s.firstName && s.lastName 
          ? `${s.firstName} ${s.lastName}`.trim()
          : s.name || s.email || 'Unknown Staff'
        staffMap.set(s._id.toString(), {
          _id: s._id,
          name,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
        })
      })
    }

    // Attach staff info to sales
    const salesWithStaff = sales.map((sale: any) => {
      if (sale.staffId) {
        const staffInfo = staffMap.get(sale.staffId.toString())
        if (staffInfo) {
          sale.staffId = staffInfo
        }
      } else {
        // No staffId = owner made the sale
        sale.staffId = ownerInfo
      }
      return sale
    })

    return NextResponse.json({ sales: salesWithStaff })
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
    
    // ── EARLY WALK-IN VALIDATION: Reject walk-in for any underpayment ─────────
    const debt = Math.max(0, saleTotal - totalPaid)
    if (debt > 0 && !data.customerId) {
      return NextResponse.json({ 
        error: 'Walk-in customers cannot have unpaid balances. Please select a registered customer or pay the full amount.' 
      }, { status: 400 })
    }
    
    // Allow overpayment for cash (change scenario), but prevent for other methods
    const hasCashPayment = payments.some((p: any) => p.method === 'cash')
    if (totalPaid > saleTotal && !hasCashPayment) {
      return NextResponse.json({ 
        error: `Payment amount (${totalPaid.toFixed(2)}) exceeds sale total (${saleTotal.toFixed(2)}). Overpayment only allowed for cash payments.` 
      }, { status: 400 })
    }

    // Determine payment status
    let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'paid'
    let debtOffsetAmount = 0  // Track how much existing debt was cleared
    
    if (debt > 0) {
      paymentStatus = totalPaid > 0 ? 'partial' : 'unpaid'
    }

    // ── SMART DEBT OFFSET: Apply overpayment to existing customer debt ────────
    if (totalPaid > saleTotal && data.customerId) {
      const overpayment = totalPaid - saleTotal
      const customer = await models.Customer.findById(data.customerId)
      
      if (customer && customer.creditBalance > 0) {
        // Apply overpayment to existing debt
        const debtCleared = Math.min(overpayment, customer.creditBalance)
        customer.creditBalance -= debtCleared
        debtOffsetAmount = debtCleared
        
        // Add ledger entry for debt offset
        customer.ledger.push({
          date: new Date(),
          type: 'payment',
          amount: -debtCleared,  // Negative = debt reduced
          balance: customer.creditBalance,
          saleId: null,  // Will be updated after sale creation
          note: `Overpayment from sale ${orderNumber} - Debt offset`,
        })
        
        // If there's remaining overpayment beyond clearing debt, store as credit (wallet)
        const remainingCredit = overpayment - debtCleared
        if (remainingCredit > 0) {
          customer.creditBalance = -remainingCredit  // Negative balance = store credit
          customer.ledger.push({
            date: new Date(),
            type: 'payment',
            amount: -remainingCredit,
            balance: customer.creditBalance,
            saleId: null,
            note: `Credit balance from overpayment on sale ${orderNumber}`,
          })
        }
        
        await customer.save()
      }
    }

    // ── STOCK DEDUCTION & LEDGER ──────────────────────────────────────────────
    for (const item of data.items) {
      if (!item.productId) continue
      try {
        const productObjId = new Types.ObjectId(item.productId)
        
        let previousStock = 0
        let newStock = 0

        // Multi-branch: update ProductInventory (branch-specific stock)
        if (branchContext) {
          const inventory = await models.ProductInventory.findOne({
            userId: ownerId,
            branchId: branchContext,
            productId: productObjId,
          })

          if (inventory) {
            previousStock = inventory.stock ?? 0
            newStock = Math.max(0, previousStock - item.quantity)
            
            // Update branch-specific inventory
            inventory.stock = newStock
            inventory.lastUpdated = new Date()
            await inventory.save()
          } else {
            console.warn(`[sales] No ProductInventory found for product ${productObjId} in branch ${branchContext}`)
            continue
          }

          // Also update Product.stock for backward compatibility (legacy field)
          await models.Product.findByIdAndUpdate(
            productObjId,
            { $inc: { stock: -item.quantity }, updatedAt: new Date() }
          )
        } else {
          // Legacy single-branch: update Product.stock only
          const product = await models.Product.findById(productObjId).select('stock').lean() as any
          if (!product) continue
          
          previousStock = product.stock ?? 0
          newStock = Math.max(0, previousStock - item.quantity)
          
          await models.Product.findByIdAndUpdate(
            productObjId,
            { $inc: { stock: -item.quantity }, updatedAt: new Date() }
          )
        }

        try {
          console.log('[sales] Creating StockLedger entry:', {
            userId: ownerId,
            branchId: branchContext,
            branchIdType: typeof branchContext,
            productId: productObjId,
            type: 'SALE',
            quantity: -item.quantity,
          })
          
          const ledgerEntry = await (models as any).StockLedger.create({
            userId:        ownerId,
            branchId:      branchContext ? new Types.ObjectId(branchContext) : null,
            productId:     productObjId,
            staffId:       payload.type === 'staff' ? new Types.ObjectId(payload.userId) : null,
            type:          'SALE',
            quantity:      -item.quantity,
            previousStock,
            newStock,
            orderNumber,
            timestamp:     new Date(),
          })
          
          console.log('[sales] StockLedger created:', {
            id: ledgerEntry._id,
            branchId: ledgerEntry.branchId,
            hasBranchId: !!ledgerEntry.branchId,
          })
        } catch (ledgerError) {
          console.error('[sales] StockLedger creation failed:', ledgerError)
        }
      } catch (productError) {
        console.error('[sales] Product processing failed:', productError)
      }
    }

    // ── CUSTOMER DEBT HANDLING (for underpayment) ─────────────────────────────
    let customerId = data.customerId || null
    let customerName = data.customerName || ''

    if (customerId && debt > 0) {
      // Auto-record new debt for underpayment
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
      // No new debt, but customer is selected (fully paid or overpaid)
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
        customMethodId: p.customMethodId || null,
        customMethodName: p.customMethodName || '',
        mpesaCode: p.mpesaCode || '',
        mpesaPhone: p.mpesaPhone || '',
        mpesaType: p.mpesaType || 'manual',
        timestamp: p.timestamp || new Date(),
      })),
      debt,
      paymentStatus,
      
      // Legacy fields for backward compatibility
      amountPaid: totalPaid,
      paymentMethod: payments[0]?.method || 'cash',
      mpesaCode: payments.find((p: any) => p.method === 'mobile_money')?.mpesaCode || '',
      mpesaPhone: payments.find((p: any) => p.method === 'mobile_money')?.mpesaPhone || '',
      creditApplied: debtOffsetAmount,  // Track debt offset amount
      
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

    // Fetch updated customer balance for receipt
    let customerBalance: number | null = null
    if (customerId) {
      const updatedCustomer = await models.Customer.findById(customerId).select('creditBalance').lean() as any
      if (updatedCustomer) {
        customerBalance = updatedCustomer.creditBalance
      }
    }

    // Prepare payment breakdown for receipt (cash paid vs debt created)
    const cashPaid = totalPaid - Math.max(0, debt)  // Actual cash received
    const debtCreated = Math.max(0, debt)           // Amount added to customer account

    return NextResponse.json({ 
      sale, 
      customerBalance,
      paymentBreakdown: {
        cashPaid,
        debtCreated,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('[sales] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create sale' }, { status: 500 })
  }
}
