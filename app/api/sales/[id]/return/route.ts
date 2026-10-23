// ─── POST /api/sales/[id]/return ──────────────────────────────────────────────
// Process item returns from a sale
// Creates RETURN or DAMAGE movements based on item condition

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

interface ReturnItem {
  productId: string
  productName: string
  quantity: number
  price: number
  condition: 'resellable' | 'damaged'
  refundAmount?: number
  refundMethod?: string
  bankProviderId?: string
  bankProviderName?: string
  customMethodId?: string
  customMethodName?: string
  mpesaCode?: string
  mpesaPhone?: string
  // Lot tracking — caller may supply the batchId from the original sale line
  batchId?: string
  lotLabel?: string
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
    const branchContext = await getBranchContext(request)
    const staffId = payload.type === 'staff' ? payload.userId : null

    // Await params before accessing properties
    const { id } = await params

    // Parse request body with error handling
    let body: {
      items: ReturnItem[]
      reason: string
      notes?: string
    }
    
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { items, reason, notes } = body

    // Validate
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Return reason is required' }, { status: 400 })
    }

    // Get sale
    const saleId = new Types.ObjectId(id)
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Process returns - CREATE AS PENDING (no stock changes yet)
    const processedItems: any[] = []
    const returnEntries: any[] = []
    
    for (const returnItem of items) {
      if (!returnItem.productId || returnItem.quantity <= 0) continue

      const productObjId = new Types.ObjectId(returnItem.productId)

      // Auto-resolve batchId from the original sale line if caller didn't supply it.
      // When the same product appears on multiple lines (different lots), match by
      // batchId first, then fall back to productId-only match.
      let resolvedBatchId: Types.ObjectId | undefined
      let resolvedLotLabel: string | undefined

      if (returnItem.batchId) {
        resolvedBatchId  = new Types.ObjectId(returnItem.batchId)
        resolvedLotLabel = returnItem.lotLabel || ''
      } else {
        // Try to find a sale line item that has a batchId for this product
        const saleLineItem = sale.items.find(
          (item: any) => item.productId?.toString() === returnItem.productId && item.batchId
        )
        if (saleLineItem?.batchId) {
          resolvedBatchId  = saleLineItem.batchId
          resolvedLotLabel = saleLineItem.lotLabel || ''
        }
      }

      // Build return entry for sale document - NO STOCK CHANGES YET
      returnEntries.push({
        productId: productObjId,
        productName: returnItem.productName,
        quantity: returnItem.quantity,
        price: returnItem.price,
        condition: returnItem.condition,
        reason: reason.trim(),
        notes: notes?.trim() || '',
        returnedBy: staffId ? new Types.ObjectId(staffId) : null,
        returnedAt: new Date(),
        status: 'pending', // Awaiting approval
        refundAmount: returnItem.refundAmount || (returnItem.quantity * returnItem.price),
        refundMethod: returnItem.refundMethod || '',
        bankProviderId: returnItem.bankProviderId || null,
        bankProviderName: returnItem.bankProviderName || '',
        customMethodId: returnItem.customMethodId || null,
        customMethodName: returnItem.customMethodName || '',
        mpesaCode: returnItem.mpesaCode || '',
        mpesaPhone: returnItem.mpesaPhone || '',
        // Lot tracking fields — stored so approval route can reverse the right batch
        ...(resolvedBatchId  && { batchId:  resolvedBatchId  }),
        ...(resolvedLotLabel && { lotLabel: resolvedLotLabel }),
      })

      processedItems.push({
        productName: returnItem.productName,
        quantity: returnItem.quantity,
        condition: returnItem.condition,
        status: 'pending',
      })
    }

    // Calculate total returned value
    const totalReturnedValue = returnEntries.reduce((sum, entry) => {
      return sum + (entry.refundAmount || 0)
    }, 0)

    // Do NOT change sale status - returns are pending approval
    const updateData: any = {
      $push: { returns: { $each: returnEntries } },
    }

    await models.Sale.findByIdAndUpdate(saleId, updateData)

    return NextResponse.json({
      success: true,
      saleNumber: sale.orderNumber,
      itemsReturned: processedItems.length,
      items: processedItems,
      message: 'Return request submitted - awaiting approval',
    }, { status: 200 })

  } catch (error) {
    console.error('[sales/[id]/return] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process return' },
      { status: 500 }
    )
  }
}
