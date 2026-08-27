// ─── POST /api/bar/pos-sale ────────────────────────────────────────────────────
// Processes a Bar POS direct sale using synthetic tab approach for unified bottle tracking.
//
// V2 Unified Bottle Tracking:
//   ALL serving sales (tab or direct) now flow through TabManager to ensure:
//   - Proper bottle selection and deduction via InventoryEngine
//   - BarTabLine creation with bottleId tracking
//   - Unified audit logging
//   - Activity timeline visibility
//
// Flow:
//   1. Create synthetic tab (marked with isSyntheticDirectSale: true)
//   2. Add all items via TabManager.addLine() → bottle tracking automatic
//   3. Close synthetic tab immediately with payment details
//   4. Create Sale record for backward compatibility
//
// Body shape accepted (same as shared payment page sends):
// {
//   items: [{ productId, productName, quantity, price, discount }],
//   subtotal, discount, total, amountPaid, paymentMethod,
//   mpesaCode?, mpesaPhone?, customerId?, customerName?
// }

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB }  from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { TabManager } from '@/lib/bar/tab-manager'

async function nextOrderNumber(models: any, userId: string): Promise<string> {
  const last = await models.Sale.findOne({ userId, source: 'bar' })
    .sort({ createdAt: -1 })
    .select('orderNumber')
    .lean() as any
  if (last?.orderNumber) {
    const n = parseInt(last.orderNumber.replace(/\D/g, '')) || 0
    return `BAR-${String(n + 1).padStart(5, '0')}`
  }
  return 'BAR-00001'
}

export async function POST(request: NextRequest) {
  try {
    console.log('[bar/pos-sale] ========== POST STARTED ==========')
    
    const payload = await getAuthPayload()
    if (!payload) {
      console.log('[bar/pos-sale] ❌ Unauthorized - no auth payload')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[bar/pos-sale] ✅ Auth payload:', { userId: payload.userId, type: payload.type })

    const { models, conn } = await getTenantDB(request)
    console.log('[bar/pos-sale] ✅ Connected to DB:', conn.name)
    
    const ownerId = payload.type === 'staff' && payload.adminId
      ? payload.adminId
      : payload.userId
    console.log('[bar/pos-sale] Owner ID:', ownerId)

    const body = await request.json()
    const {
      items,
      subtotal,
      discount: cartDiscount,
      total,
      amountPaid,
      paymentMethod,
      mpesaCode,
      mpesaPhone,
      customerId,
      customerName,
    } = body

    console.log('[bar/pos-sale] Request body:', {
      itemCount: items?.length,
      total,
      paymentMethod,
      hasItems: !!items?.length
    })

    if (!items?.length) {
      console.log('[bar/pos-sale] ❌ Cart is empty')
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }
    if (!paymentMethod) {
      console.log('[bar/pos-sale] ❌ Payment method missing')
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    // ── Customer credit validation ────────────────────────────────────────────
    if (paymentMethod === 'credit' && customerId) {
      const customer = await models.Customer.findOne({ _id: customerId, userId: ownerId })
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }

      // Require ID number for credit sales
      if (!customer.idNumber || customer.idNumber.trim() === '') {
        return NextResponse.json({
          error: 'ID number required for credit sales',
          requiresId: true,
          customerId: customerId,
          customerName: customer.name
        }, { status: 400 })
      }

      const unpaidAmount = Math.max(0, total - (amountPaid ?? 0))
      if (unpaidAmount > 0) {
        // Check credit limit
        const currentBalance = customer.creditBalance ?? 0
        const creditLimit = customer.creditLimit ?? 0
        const newBalance = currentBalance + unpaidAmount

        if (creditLimit > 0 && newBalance > creditLimit) {
          return NextResponse.json({
            error: `Credit limit exceeded. Available: KES ${(creditLimit - currentBalance).toLocaleString()}, Required: KES ${unpaidAmount.toLocaleString()}`
          }, { status: 400 })
        }

        customer.creditBalance = newBalance
        customer.ledger = customer.ledger ?? []
        customer.ledger.push({
          type:    'purchase',
          amount:  unpaidAmount,
          balance: newBalance,
          saleId:  null, // Will be set after sale creation
          note:    `Bar POS credit — ${new Date().toLocaleDateString()}`,
          date:    new Date(),
        })
        await customer.save()
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // V2 UNIFIED BOTTLE TRACKING: Use synthetic tab approach
    // ══════════════════════════════════════════════════════════════════════════

    console.log('[bar/pos-sale] 🧪 Creating synthetic tab...')
    // 1. Create synthetic direct sale tab
    const syntheticTab = await TabManager.createSyntheticDirectSaleTab(
      {
        userId:       ownerId,
        branchId:     undefined, // Use branchId if available in context
        staffId:      payload.userId,
        customerId:   customerId || undefined,
        customerName: customerName || 'Bar Sale',
        tableNumber:  'DIRECT',
        notes:        `Direct sale - ${paymentMethod}`,
      },
      conn
    )

    const tabId = String((syntheticTab as any)._id)
    console.log('[bar/pos-sale] ✅ Synthetic tab created:', tabId)

    // 2. Add all items via TabManager → bottle tracking happens automatically
    const saleItems: any[] = []

    console.log('[bar/pos-sale] 🔄 Processing items...')
    for (const item of items as any[]) {
      const rawId       = (item.productId || '').trim()
      const isServing   = rawId.includes('__')
      const invItemId   = isServing ? rawId.split('__')[0] : rawId
      const servingName = isServing ? rawId.split('__').slice(1).join('__') : ''
      const unitPrice   = item.price ?? item.unitPrice ?? 0

      console.log(`[bar/pos-sale]   Item: ${item.productName || 'Unknown'}, isServing: ${isServing}, id: ${invItemId}`)

      // Look up actual serving and inventory item for proper tracking
      if (isServing) {
        const serving = await models.BarServing.findOne({
          inventoryItemId: invItemId,
          userId:          ownerId,
          name:            servingName,
          isActive:        true,
        }).lean() as any

        const invItem = await models.BarInventoryItem.findById(invItemId).lean() as any

        if (!serving) {
          throw new Error(`Serving not found: ${invItemId} / ${servingName}`)
        }

        if (!invItem) {
          throw new Error(`Inventory item not found: ${invItemId}`)
        }

        // Add line via TabManager → automatic bottle tracking!
        // If this fails, the entire sale should fail (no silent fallback)
        console.log(`[bar/pos-sale]     ✅ Found serving & inventory item, calling TabManager.addLine()`)
        await TabManager.addLine(
          tabId,
          {
            inventoryItemId: invItemId,
            servingId:       String(serving._id),
            quantity:        item.quantity,
            staffId:         payload.userId,
            itemName:        invItem.name,
            servingName:     servingName,
            unitPrice:       serving.sellingPrice,
          },
          conn
        )
        console.log(`[bar/pos-sale]     ✅ TabManager.addLine() succeeded for serving`)

        saleItems.push({
          productId:   invItemId,
          productName: `${invItem.name} (${servingName})`,
          quantity:    item.quantity,
          price:       serving.sellingPrice,
          discount:    item.discount ?? 0,
          total:       serving.sellingPrice * item.quantity - (item.discount ?? 0),
        })
      } else {
        // Sealed bottle sale → TabManager.addLine with servingId: null
        const invItem = await models.BarInventoryItem.findById(invItemId).lean() as any

        if (!invItem) {
          throw new Error(`Inventory item not found: ${invItemId}`)
        }

        await TabManager.addLine(
          tabId,
          {
            inventoryItemId: invItemId,
            servingId:       null,  // Bottle sale
            quantity:        item.quantity,
            staffId:         payload.userId,
            itemName:        invItem.name,
            servingName:     '',
            unitPrice:       invItem.sellingPrice || unitPrice,
          },
          conn
        )

        saleItems.push({
          productId:   invItemId,
          productName: invItem.name,
          quantity:    item.quantity,
          price:       invItem.sellingPrice || unitPrice,
          discount:    item.discount ?? 0,
          total:       (invItem.sellingPrice || unitPrice) * item.quantity - (item.discount ?? 0),
        })
      }
    }

    console.log('[bar/pos-sale] 🔒 Closing synthetic tab...')
    // 3. Close synthetic tab immediately with payment details
    await TabManager.closeSyntheticTab(
      tabId,
      {
        paymentMethod: paymentMethod as any,
        amountPaid:    amountPaid ?? total,
        mpesaCode:     paymentMethod === 'mobile_money' ? mpesaCode : undefined,
        mpesaPhone:    paymentMethod === 'mobile_money' ? mpesaPhone : undefined,
        staffId:       payload.userId,
      },
      conn
    )
    console.log('[bar/pos-sale] ✅ Synthetic tab closed')

    console.log('[bar/pos-sale] 📝 Creating Sale record for compatibility...')
    // 4. Create Sale record for backward compatibility with existing reports
    const orderNumber = await nextOrderNumber(models, ownerId)

    const sale = await models.Sale.create({
      userId:       ownerId,
      staffId:      payload.type === 'staff' ? payload.userId : null,
      customerId:   customerId || null,
      customerName: customerName || 'Bar Sale',
      items:        saleItems,
      subtotal:     subtotal ?? total,
      discount:     cartDiscount ?? 0,
      total,
      amountPaid:   amountPaid ?? total,
      paymentMethod,
      mpesaCode:    paymentMethod === 'mobile_money' ? (mpesaCode ?? null) : null,
      mpesaPhone:   paymentMethod === 'mobile_money' ? (mpesaPhone ?? null) : null,
      source:       'bar',
      status:       'completed',
      orderNumber,
      synced:       true,
      createdAt:    new Date(),
    })

    console.log('[bar/pos-sale] ✅ Sale created:', { saleId: sale._id, orderNumber, syntheticTabId: tabId })
    console.log('[bar/pos-sale] ========== POST COMPLETED SUCCESSFULLY ==========')
    return NextResponse.json({ sale, orderNumber, syntheticTabId: tabId }, { status: 201 })
  } catch (error: any) {
    console.error('[bar/pos-sale] ========== POST ERROR ==========')
    console.error('[bar/pos-sale] Error message:', error.message)
    console.error('[bar/pos-sale] Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to process sale' },
      { status: 500 }
    )
  }
}

