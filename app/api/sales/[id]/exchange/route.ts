// ─── POST /api/sales/[id]/exchange ────────────────────────────────────────────
// Process item exchange: customer returns one or more items + gets one or more
// new ones back (possibly with a net price difference).
// Stock changes happen on approval, not here — this only records a pending entry.

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── Input shapes ──────────────────────────────────────────────────────────────

interface ReturnedItemInput {
  productId: string
  productName: string
  quantity: number
  price: number        // original sale price per unit
}

interface NewItemInput {
  productId: string
  productName: string
  quantity: number
  price: number          // catalog selling price
  overridePrice?: number | null  // cashier-set price; replaces catalog price when provided
  discount?: number              // per-item discount in KSh (applied after override/catalog price)
}

interface ExchangeRequest {
  returnedItems: ReturnedItemInput[]
  newItems: NewItemInput[]

  reason: string
  notes?: string

  // Payment for any positive price difference
  paymentMethod?: string
  bankProviderId?: string
  bankProviderName?: string
  customMethodId?: string
  customMethodName?: string
  mpesaCode?: string
  mpesaPhone?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null

    const { id } = await params

    let body: ExchangeRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const {
      returnedItems,
      newItems,
      reason,
      notes,
      paymentMethod,
      bankProviderId,
      bankProviderName,
      customMethodId,
      customMethodName,
      mpesaCode,
      mpesaPhone,
    } = body

    // ── Top-level validation ───────────────────────────────────────────────────
    if (!returnedItems || returnedItems.length === 0) {
      return NextResponse.json({ error: 'At least one item to return is required' }, { status: 400 })
    }
    if (!newItems || newItems.length === 0) {
      return NextResponse.json({ error: 'At least one new item is required' }, { status: 400 })
    }
    if (!reason?.trim()) {
      // Reason is optional — default to empty string if not provided
    }

    // ── Load sale ─────────────────────────────────────────────────────────────
    const saleId = new Types.ObjectId(id)
    const sale = await models.Sale.findOne({ _id: saleId, userId: ownerId })
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    // ── Validate returned items ───────────────────────────────────────────────
    // Each returned item must:
    //   1. Have a valid productId and quantity > 0
    //   2. Exist in this tenant's product catalogue (so the product reference is legit)
    //   3. Appear on the original sale (so the customer actually bought it)
    //   4. Not exceed the quantity originally purchased on that sale line

    const validatedReturnedItems: Array<{
      productId: Types.ObjectId
      productName: string
      quantity: number
      price: number
    }> = []

    for (const ri of returnedItems) {
      if (!ri.productId || ri.quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid returned item: ${ri.productName || ri.productId}` },
          { status: 400 }
        )
      }

      const productObjId = new Types.ObjectId(ri.productId)

      // Must exist in product catalogue
      const product = await models.Product.findOne({ _id: productObjId, userId: ownerId })
      if (!product) {
        return NextResponse.json(
          { error: `Returned product not found: ${ri.productName}` },
          { status: 404 }
        )
      }

      // Must appear on the original sale
      const saleLine = sale.items.find(
        (item: any) => item.productId?.toString() === ri.productId
      )
      if (!saleLine) {
        return NextResponse.json(
          { error: `${ri.productName} was not on this sale` },
          { status: 400 }
        )
      }

      // Cannot return more than was sold
      if (ri.quantity > saleLine.quantity) {
        return NextResponse.json(
          {
            error: `Cannot return ${ri.quantity} × ${ri.productName} — only ${saleLine.quantity} was sold`,
          },
          { status: 400 }
        )
      }

      validatedReturnedItems.push({
        productId: productObjId,
        productName: ri.productName,
        quantity: ri.quantity,
        price: ri.price,
      })
    }

    // ── Validate new items ────────────────────────────────────────────────────
    // Each new item must:
    //   1. Have a valid productId and quantity > 0
    //   2. Exist in this tenant's catalogue
    //   3. Have sufficient stock
    //   4. Have a non-negative discount (if supplied)
    //   5. Have a positive overridePrice (if supplied)

    const validatedNewItems: Array<{
      productId: Types.ObjectId
      productName: string
      quantity: number
      price: number
      overridePrice: number | null
      discount: number
      effectivePrice: number
    }> = []

    for (const ni of newItems) {
      if (!ni.productId || ni.quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid new item: ${ni.productName || ni.productId}` },
          { status: 400 }
        )
      }

      const productObjId = new Types.ObjectId(ni.productId)

      const product = await models.Product.findOne({ _id: productObjId, userId: ownerId })
      if (!product) {
        return NextResponse.json(
          { error: `New product not found: ${ni.productName}` },
          { status: 404 }
        )
      }

      const currentStock = product.stock || 0
      if (currentStock < ni.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${ni.productName}. Available: ${currentStock}` },
          { status: 400 }
        )
      }

      const overridePrice = ni.overridePrice != null ? Number(ni.overridePrice) : null
      const discount = Number(ni.discount ?? 0)

      if (overridePrice !== null && overridePrice < 0) {
        return NextResponse.json(
          { error: `Override price for ${ni.productName} cannot be negative` },
          { status: 400 }
        )
      }
      if (discount < 0) {
        return NextResponse.json(
          { error: `Discount for ${ni.productName} cannot be negative` },
          { status: 400 }
        )
      }

      // effectivePrice = (overridePrice ?? catalogPrice) - discount, floored at 0
      const basePrice = overridePrice !== null ? overridePrice : Number(ni.price)
      const effectivePrice = Math.max(0, basePrice - discount)

      validatedNewItems.push({
        productId: productObjId,
        productName: ni.productName,
        quantity: ni.quantity,
        price: Number(ni.price),
        overridePrice,
        discount,
        effectivePrice,
      })
    }

    // ── Compute net price difference ──────────────────────────────────────────
    // positive → customer pays extra
    // negative → customer receives credit / refund
    const totalReturnedValue = validatedReturnedItems.reduce(
      (sum, ri) => sum + ri.quantity * ri.price, 0
    )
    const totalNewValue = validatedNewItems.reduce(
      (sum, ni) => sum + ni.quantity * ni.effectivePrice, 0
    )
    const priceDifference = Math.round((totalNewValue - totalReturnedValue) * 100) / 100

    // ── Build and persist the exchange entry (status: pending) ────────────────
    const exchangeEntry: any = {
      // Multi-item arrays (primary data)
      returnedItems: validatedReturnedItems,
      newItems: validatedNewItems,

      // Legacy singular fields — populated from the first item so old display
      // code that reads these fields still renders something meaningful.
      returnedProductId:   validatedReturnedItems[0].productId,
      returnedProductName: validatedReturnedItems[0].productName,
      quantityReturned:    validatedReturnedItems[0].quantity,
      returnedPrice:       validatedReturnedItems[0].price,
      newProductId:        validatedNewItems[0].productId,
      newProductName:      validatedNewItems[0].productName,
      quantityReceived:    validatedNewItems[0].quantity,
      newPrice:            validatedNewItems[0].effectivePrice,

      priceDifference,
      reason: reason?.trim() || '',
      notes: notes?.trim() || '',
      processedBy: staffId ? new Types.ObjectId(staffId) : null,
      processedAt: new Date(),
      status: 'pending',

      paymentMethod:    paymentMethod    || '',
      bankProviderId:   bankProviderId   || null,
      bankProviderName: bankProviderName || '',
      customMethodId:   customMethodId   || null,
      customMethodName: customMethodName || '',
      mpesaCode:        mpesaCode        || '',
      mpesaPhone:       mpesaPhone       || '',
    }

    await models.Sale.findByIdAndUpdate(saleId, { $push: { exchanges: exchangeEntry } })

    return NextResponse.json({
      success: true,
      saleNumber: sale.orderNumber,
      message: 'Exchange request submitted — awaiting approval',
      exchange: {
        returnedItems: validatedReturnedItems.map(ri => ({
          productName: ri.productName,
          quantity: ri.quantity,
          price: ri.price,
        })),
        newItems: validatedNewItems.map(ni => ({
          productName: ni.productName,
          quantity: ni.quantity,
          catalogPrice: ni.price,
          overridePrice: ni.overridePrice,
          discount: ni.discount,
          effectivePrice: ni.effectivePrice,
        })),
        totalReturnedValue,
        totalNewValue,
        priceDifference,
        status: 'pending',
      },
    }, { status: 200 })

  } catch (error) {
    console.error('[sales/[id]/exchange] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process exchange' },
      { status: 500 }
    )
  }
}
