// ─── POST /api/bar/pos-sale ────────────────────────────────────────────────────
// Processes a Bar POS direct sale (no tab lifecycle).
//
// Stock deduction rules:
//   Serving sale  (productId = "inventoryItemId__servingName"):
//     → deduct 1 unit per serving sold from the open BarBottle.remainingUnits.
//     → if no open bottle exists, deduct fractional sealed stock.
//     → if bottle hits 0 remaining units, auto-close it.
//   Bottle sale (productId = plain inventoryItemId):
//     → deduct quantity from BarInventoryItem.stock directly.
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
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId
      ? payload.adminId
      : payload.userId

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

    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }
    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    // ── Customer credit ───────────────────────────────────────────────────────
    if (paymentMethod === 'credit' && customerId) {
      const customer = await models.Customer.findOne({ _id: customerId, userId: ownerId })
      if (customer) {
        const unpaidAmount = Math.max(0, total - (amountPaid ?? 0))
        if (unpaidAmount > 0) {
          customer.creditBalance = (customer.creditBalance ?? 0) + unpaidAmount
          customer.ledger = customer.ledger ?? []
          customer.ledger.push({
            type:           'purchase',
            amount:         unpaidAmount,
            description:    `Bar POS credit — ${new Date().toLocaleDateString()}`,
            date:           new Date(),
            runningBalance: customer.creditBalance,
          })
          await customer.save()
        }
      }
    }

    // ── Build sale items + deduct bar inventory ───────────────────────────────
    const saleItems: any[] = []

    for (const item of items as any[]) {
      const rawId       = (item.productId || '').trim()
      const isServing   = rawId.includes('__')
      const invItemId   = isServing ? rawId.split('__')[0] : rawId
      const servingName = isServing ? rawId.split('__').slice(1).join('__') : ''
      const price       = item.price ?? item.unitPrice ?? 0

      saleItems.push({
        productId:   invItemId || '000000000000000000000001',
        productName: item.productName || item.label || 'Bar Item',
        quantity:    item.quantity,
        price,
        discount:    item.discount ?? 0,
        total:       price * item.quantity - (item.discount ?? 0),
      })

      // ── Deduct stock ────────────────────────────────────────────────────────
      // Errors here must never abort the sale — catch and log only.
      try {
        if (isServing) {
          // Find the open bottle for this inventory item
          const openBottle = await models.BarBottle.findOne({
            inventoryItemId: invItemId,
            userId:          ownerId,
            state:           'open',
          })

          if (openBottle) {
            // Each serving sold = 1 unit deducted from the open bottle
            const unitsToDeduct  = item.quantity
            const prevRemaining  = openBottle.remainingUnits ?? 0
            openBottle.remainingUnits = Math.max(0, prevRemaining - unitsToDeduct)
            openBottle.updatedAt = new Date()

            // Auto-close bottle when empty
            if (openBottle.remainingUnits === 0) {
              openBottle.state           = 'closed'
              openBottle.closedAt        = new Date()
              openBottle.actualUnitsSold = openBottle.expectedUnits ?? prevRemaining
              openBottle.difference      = (openBottle.expectedUnits ?? prevRemaining) - openBottle.actualUnitsSold
            }
            await openBottle.save()

            // Audit
            await models.BarAuditLog.create({
              userId:        ownerId,
              staffId:       payload.userId,
              operation:     'SERVING_SOLD',
              referenceId:   String(openBottle._id),
              referenceType: 'BarBottle',
              details: {
                inventoryItemId: invItemId,
                servingName,
                quantitySold:    item.quantity,
                remainingUnits:  openBottle.remainingUnits,
              },
              timestamp: new Date(),
            }).catch(() => {/* non-fatal */})
          } else {
            // No open bottle — look up how many servings per bottle to compute
            // fractional sealed bottle deduction.
            const serving = await models.BarServing.findOne({
              inventoryItemId: invItemId,
              userId:          ownerId,
              name:            servingName,
              isActive:        true,
            }).lean() as any

            const unitsPerBottle = serving?.unitsProduced ?? 1
            // How many whole sealed bottles does this serving quantity consume?
            const wholeBottles = Math.floor(item.quantity / unitsPerBottle)
            if (wholeBottles > 0) {
              await models.BarInventoryItem.findOneAndUpdate(
                { _id: invItemId, userId: ownerId },
                { $inc: { stock: -wholeBottles }, updatedAt: new Date() }
              )
            }
          }
        } else {
          // Whole-bottle sale — deduct directly from sealed stock
          const before = await models.BarInventoryItem.findOne(
            { _id: invItemId, userId: ownerId }
          ).select('stock').lean() as any

          await models.BarInventoryItem.findOneAndUpdate(
            { _id: invItemId, userId: ownerId },
            { $inc: { stock: -item.quantity }, updatedAt: new Date() }
          )

          // Audit
          await models.BarAuditLog.create({
            userId:        ownerId,
            staffId:       payload.userId,
            operation:     'BOTTLE_SOLD',
            referenceId:   invItemId,
            referenceType: 'BarInventoryItem',
            details: {
              quantitySold:  item.quantity,
              stockBefore:   before?.stock ?? 0,
              stockAfter:    Math.max(0, (before?.stock ?? 0) - item.quantity),
            },
            timestamp: new Date(),
          }).catch(() => {/* non-fatal */})
        }
      } catch (deductErr) {
        console.error('[bar/pos-sale] stock deduction error:', invItemId, deductErr)
      }
    }

    // ── Order number + Sale record ────────────────────────────────────────────
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

    // ── Sale-level audit log ──────────────────────────────────────────────────
    models.BarAuditLog.create({
      userId:    ownerId,
      staffId:   payload.userId,
      operation: 'TAB_CLOSED',
      details: {
        action:      'bar_pos_sale',
        orderNumber,
        saleId:      String(sale._id),
        total,
        paymentMethod,
        itemCount:   items.length,
      },
      timestamp: new Date(),
    }).catch(() => {/* non-fatal */})

    return NextResponse.json({ sale, orderNumber }, { status: 201 })
  } catch (error: any) {
    console.error('[bar/pos-sale] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process sale' },
      { status: 500 }
    )
  }
}
