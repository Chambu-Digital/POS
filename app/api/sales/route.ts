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
    
    // Get query parameters
    const url = new URL(request.url)
    const customerId = url.searchParams.get('customerId')
    const paymentStatusParam = url.searchParams.get('paymentStatus')

    const query: any = { userId: ownerId, voidedAt: null }
    if (branchContext) {
      query.branchId = branchContext
    }
    
    // Filter by customerId if provided
    if (customerId) {
      query.customerId = new Types.ObjectId(customerId)
    }
    
    // Filter by paymentStatus if provided (supports comma-separated values)
    if (paymentStatusParam) {
      const statuses = paymentStatusParam.split(',').map(s => s.trim())
      query.paymentStatus = { $in: statuses }
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

    // ── Backfill missing brand/model/variant for old orders ──────────────────
    // Collect all unique productIds from items that are missing these fields
    const productIdsToLookup = new Set<string>()
    salesWithStaff.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        if (item.productId && (!item.brand && !item.model && !item.variant)) {
          productIdsToLookup.add(item.productId.toString())
        }
      })
    })

    // Fetch product details if needed
    let productMap = new Map()
    if (productIdsToLookup.size > 0) {
      const products = await conn.db.collection('products')
        .find({ _id: { $in: Array.from(productIdsToLookup).map(id => new Types.ObjectId(id)) } })
        .project({ _id: 1, brand: 1, model: 1, variant: 1 })
        .toArray()

      products.forEach((p: any) => {
        productMap.set(p._id.toString(), {
          brand: p.brand || '',
          model: p.model || '',
          variant: p.variant || '',
        })
      })
    }

    // Enrich items with missing brand/model/variant
    salesWithStaff.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        if (item.productId && (!item.brand && !item.model && !item.variant)) {
          const productInfo = productMap.get(item.productId.toString())
          if (productInfo) {
            item.brand = productInfo.brand
            item.model = productInfo.model
            item.variant = productInfo.variant
          }
        }
      })
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

    const { models, conn } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    // Generate unique order number FIRST (needed for ledger entries)
    const orderNumber = await generateOrderNumber(models, ownerId)

    // ── PAYMENT VALIDATION ────────────────────────────────────────────────────
    // Apply totalRounding setting before any comparison. 'ceil' rounds up to
    // the nearest whole shilling (e.g. 150.42 → 151). 'none' (default) still
    // rounds to 2dp to strip floating-point dust from multi-item totals.
    // This must match what the payment page computed as chargeTotal so the
    // walk-in underpayment guard and the overpayment guard never fire on a
    // legitimately paid sale.
    let saleTotal: number
    try {
      const userDoc = await conn.db.collection('users').findOne(
        { _id: new Types.ObjectId(ownerId) },
        { projection: { settings: 1 } }
      ) as any
      const rounding = userDoc?.settings?.receipt?.totalRounding || 'none'
      const raw = data.total || 0
      saleTotal = rounding === 'ceil'
        ? Math.ceil(raw)
        : Math.round(raw * 100) / 100
    } catch {
      // Non-fatal: fall back to 2dp rounding if settings can't be read
      saleTotal = Math.round((data.total || 0) * 100) / 100
    }
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

    // ── DEPOSIT PAYMENT VALIDATION ────────────────────────────────────────────
    // A 'deposit' payment draws down a customer prepayment. It is an internal
    // transfer, NOT new cash, so it is exempt from the walk-in underpayment and
    // cash-only-overpayment guards below. We validate ownership + balance here.
    const depositPayments = payments.filter((p: any) => p.method === 'deposit')
    const nonDepositPaid = payments
      .filter((p: any) => p.method !== 'deposit')
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0)

    // Deposit payments require a registered customer (you can't draw a
    // walk-in's non-existent prepayment).
    if (depositPayments.length > 0 && !data.customerId) {
      return NextResponse.json({
        error: 'Deposit payments require a registered customer.',
      }, { status: 400 })
    }

    // Validate each deposit payment against the actual Deposit doc(s)
    // We collect the validated deposits to mutate later, after the sale is saved.
    const validatedDeposits: { doc: any; drawAmount: number }[] = []
    for (const dp of depositPayments) {
      if (!dp.depositId) {
        return NextResponse.json({ error: 'Deposit payment is missing depositId' }, { status: 400 })
      }
      const draw = parseFloat(dp.amount) || 0
      if (draw <= 0) {
        return NextResponse.json({ error: 'Deposit payment amount must be greater than 0' }, { status: 400 })
      }
      let depositDoc
      try {
        depositDoc = await models.Deposit.findById(new Types.ObjectId(dp.depositId))
      } catch {
        depositDoc = null
      }
      if (!depositDoc) {
        return NextResponse.json({ error: `Deposit not found (id: ${dp.depositId})` }, { status: 404 })
      }
      if (depositDoc.userId.toString() !== ownerId.toString()) {
        return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })
      }
      if (!depositDoc.customerId || depositDoc.customerId.toString() !== String(data.customerId)) {
        return NextResponse.json({
          error: 'Deposit does not belong to the selected customer',
        }, { status: 400 })
      }
      if (!['active', 'partial'].includes(depositDoc.status)) {
        return NextResponse.json({
          error: `Deposit ${depositDoc.receiptNo} is not available (status: ${depositDoc.status})`,
        }, { status: 400 })
      }
      if (draw > depositDoc.balance) {
        return NextResponse.json({
          error: `Deposit ${depositDoc.receiptNo} balance (KSh ${depositDoc.balance}) is less than the requested KSh ${draw}`,
        }, { status: 400 })
      }
      validatedDeposits.push({ doc: depositDoc, drawAmount: draw })
    }

    // ── EARLY WALK-IN VALIDATION: Reject walk-in for any underpayment ─────────
    // Only consider real cash payments when computing debt; deposit drawdowns
    // are an internal transfer and can cover part/all of the sale without
    // creating debt.
    const realCashPaid = nonDepositPaid
    // Round debt to 2dp before the walk-in guard — sub-cent floating point
    // artifacts (e.g. 0.0034) should not be treated as a real underpayment.
    const debt = Math.max(0, Math.round((saleTotal - (realCashPaid + depositPayments.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0))) * 100) / 100)
    if (debt > 0 && !data.customerId) {
      return NextResponse.json({ 
        error: 'Walk-in customers cannot have unpaid balances. Please select a registered customer or pay the full amount.' 
      }, { status: 400 })
    }
    
    // Allow overpayment for cash (change scenario), but prevent for other methods.
    // Deposit payments are excluded from this check (they are capped at deposit
    // balance by the validation above and cannot overpay).
    const realCashPayments = payments.filter((p: any) => p.method !== 'deposit')
    const hasCashPayment = realCashPayments.some((p: any) => p.method === 'cash')
    const realCashTotal = realCashPayments.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0)
    if (realCashTotal > saleTotal + 0.005 && !hasCashPayment) {
      return NextResponse.json({ 
        error: `Payment amount (${realCashTotal.toFixed(2)}) exceeds sale total (${saleTotal.toFixed(2)}). Overpayment only allowed for cash payments.` 
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
            userId:    ownerId,
            branchId:  branchContext,
            productId: productObjId,
          })

          if (inventory) {
            previousStock          = inventory.stock ?? 0
            newStock               = Math.max(0, previousStock - item.quantity)
            inventory.stock        = newStock
            inventory.lastUpdated  = new Date()
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
          newStock      = Math.max(0, previousStock - item.quantity)

          await models.Product.findByIdAndUpdate(
            productObjId,
            { $inc: { stock: -item.quantity }, updatedAt: new Date() }
          )
        }

        // ── Lot tracking: decrement each ProductBatch in the breakdown ──────────
        // item.lotBreakdown is set by the sales page when the cashier uses the
        // lot picker modal.  When absent (non-lot products) this block is skipped.
        if (item.lotBreakdown && Array.isArray(item.lotBreakdown) && item.lotBreakdown.length > 0) {
          for (const lotEntry of item.lotBreakdown) {
            if (!lotEntry.batchId || !lotEntry.quantity) continue
            try {
              const batch = await (models as any).ProductBatch.findOne({
                _id:    new Types.ObjectId(lotEntry.batchId),
                userId: ownerId,
              })
              if (batch) {
                batch.quantity = Math.max(0, batch.quantity - lotEntry.quantity)
                if (batch.quantity <= 0) { batch.quantity = 0; batch.status = 'depleted' }
                batch.updatedAt = new Date()
                await batch.save()
              }
            } catch (batchError) {
              console.error('[sales] ProductBatch deduction failed for lot:', lotEntry.batchId, batchError)
            }
          }
        }

        // ── Write stock ledger entry ───────────────────────────────────────────
        try {
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
          console.log('[sales] StockLedger created:', { id: ledgerEntry._id, hasBranchId: !!ledgerEntry.branchId })
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
    // Compute COGS: fetch buying prices for all items in a single query
    let costOfGoodsSold = 0
    try {
      const productIds = data.items
        .filter((item: any) => item.productId)
        .map((item: any) => new Types.ObjectId(item.productId))
      if (productIds.length > 0) {
        const products = await models.Product.find({
          _id: { $in: productIds },
          userId: ownerId,
        }).select('_id buyingPrice').lean() as any[]
        const priceMap = new Map(products.map((p: any) => [p._id.toString(), p.buyingPrice || 0]))
        costOfGoodsSold = data.items.reduce((sum: number, item: any) => {
          const cost = priceMap.get(item.productId?.toString()) || 0
          return sum + (cost * item.quantity)
        }, 0)
      }
    } catch (cogsError) {
      // Non-fatal — COGS is a reporting field, sale can proceed without it
      console.error('[sales] COGS computation failed:', cogsError)
    }

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
        // Deposit drawdown reference (only when method === 'deposit')
        depositId: p.method === 'deposit' && p.depositId ? new Types.ObjectId(p.depositId) : null,
      })),
      debt,
      paymentStatus,
      
      // Legacy fields for backward compatibility
      amountPaid: totalPaid,
      paymentMethod: payments[0]?.method || 'cash',
      mpesaCode: payments.find((p: any) => p.method === 'mobile_money')?.mpesaCode || '',
      mpesaPhone: payments.find((p: any) => p.method === 'mobile_money')?.mpesaPhone || '',
      creditApplied: debtOffsetAmount,  // Track debt offset amount
      costOfGoodsSold,
      
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

    // ── DEPOSIT DRAWDOWN ──────────────────────────────────────────────────────
    // For each validated deposit payment, decrement the deposit balance, push
    // a consumption entry on the deposit doc, and push a 'deposit_use' ledger
    // entry on the customer (NO paymentMethod — internal transfer, not cash).
    // Stock has already decremented above via the normal sale path; this block
    // only adjusts the deposit + customer prepayment balances.
    let depositDrawnTotal = 0
    if (validatedDeposits.length > 0 && customerId) {
      const depositCustomer = await models.Customer.findById(customerId)
      const cashierId = payload.type === 'staff' ? new Types.ObjectId(payload.userId) : new Types.ObjectId(payload.userId)
      const cashierModel = payload.type === 'staff' ? 'Staff' : 'User'

      for (const { doc: depositDoc, drawAmount } of validatedDeposits) {
        // Re-fetch the deposit to get the freshest balance (defensive against
        // concurrent drawdowns; the per-deposit validation above is the
        // authoritative guard, this is the write).
        const deposit = await models.Deposit.findById(depositDoc._id)
        if (!deposit) continue

        const cappedDraw = Math.min(drawAmount, deposit.balance)
        if (cappedDraw <= 0) continue

        // Decrement deposit balance + push consumption
        deposit.balance = Math.max(0, deposit.balance - cappedDraw)
        deposit.status = deposit.balance === 0 ? 'used' : 'partial'
        deposit.consumptions.push({
          saleId: sale._id,
          orderNumber,
          amount: cappedDraw,
          date: new Date(),
          cashierId,
          cashierModel,
          note: `Applied to sale ${orderNumber}`,
        })
        await deposit.save()

        // Customer ledger: 'deposit_use' entry (internal transfer, no method)
        if (depositCustomer) {
          depositCustomer.depositBalance = Math.max(0, (depositCustomer.depositBalance || 0) - cappedDraw)
          depositCustomer.ledger.push({
            date: new Date(),
            type: 'deposit_use',
            amount: -cappedDraw, // negative = prepayment consumed
            balance: depositCustomer.depositBalance,
            saleId: sale._id,
            note: `Sale ${orderNumber} — deposit ${deposit.receiptNo}`,
            depositId: deposit._id,
            // No paymentMethod — this is an internal transfer, not new cash.
            collectedBy: cashierId,
            collectedByType: payload.type === 'staff' ? 'staff' : 'user',
          })
        }
        depositDrawnTotal += cappedDraw
      }
      if (depositCustomer) await depositCustomer.save()
    }

    // Fetch updated customer balance for receipt
    let customerBalance: number | null = null
    let depositBalance: number | null = null
    if (customerId) {
      const updatedCustomer = await models.Customer.findById(customerId).select('creditBalance depositBalance').lean() as any
      if (updatedCustomer) {
        customerBalance = updatedCustomer.creditBalance
        depositBalance = updatedCustomer.depositBalance ?? 0
      }
    }

    // Prepare payment breakdown for receipt (cash paid vs debt created)
    const cashPaid = totalPaid - Math.max(0, debt)  // Actual cash received
    const debtCreated = Math.max(0, debt)           // Amount added to customer account

    return NextResponse.json({ 
      sale, 
      customerBalance,
      depositBalance,
      paymentBreakdown: {
        cashPaid,
        debtCreated,
        depositDrawn: depositDrawnTotal,  // how much was drawn from deposits
      }
    }, { status: 201 })
  } catch (error) {
    console.error('[sales] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create sale' }, { status: 500 })
  }
}
